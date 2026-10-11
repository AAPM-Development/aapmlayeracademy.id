import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { Bar, Egg, Ic } from "@/design-system/canvas";
import { ContinueCard, CourseCard, LearningPath } from "@/components/academy/CourseElements";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useCertificates, useModules, useUserProgress } from "@/lib/useCourseData";
import { certificationTiers, getCompletedModuleSet, getNextModule, getProgressSummary, learningLevels } from "@/lib/academyData";
import { buildCurriculum } from "@/lib/academyVisuals";
import { cn } from "@/lib/utils";

const VIEW_KEY = "aapm-modules-view";
const PAGE_SIZE = 9;

function readView() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "catalog" ? "catalog" : "path";
  } catch {
    return "path";
  }
}

const statusFilters = [
  { value: "all", label: "Semua" },
  { value: "current", label: "Berjalan" },
  { value: "completed", label: "Selesai" },
  { value: "todo", label: "Belum mulai" },
];

function matchesStatus(module, status) {
  if (status === "all") return true;
  if (status === "completed") return module.state === "completed";
  if (status === "current") return module.state === "current" || (module.state !== "completed" && Boolean(module.progress));
  return module.state !== "completed" && module.state !== "current" && !module.progress;
}

/** Sticky rail beside the path: jump between levels, the next tier, the egg legend. */
function PathRail({ curriculum, completedSet, ownedTiers }) {
  const levelsDone = curriculum.filter((level) => level.total && level.completed === level.total).length;
  const nextTier = certificationTiers.find((tier) => !ownedTiers.has(tier.number));
  const tierDone = nextTier ? nextTier.modules.filter((number) => completedSet.has(number)).length : 0;
  return (
    <aside className="stack gap-grid path-rail" aria-label="Navigasi level">
      <nav className="card anim-rise" style={{ "--i": 2 }} aria-labelledby="idx-title">
        <div className="card-pad" style={{ paddingBottom: "var(--s-3)" }}>
          <h2 className="card-title" id="idx-title">Indeks level</h2>
          <p className="card-desc">{levelsDone} dari {curriculum.length} tuntas · pilih untuk melompat</p>
        </div>
        <div className="list">
          {curriculum.map((level) => {
            const done = level.total && level.completed === level.total;
            return (
              <a key={level.key || level.number} className="li" href={`#${level.anchor || `level-${level.number}`}`} style={{ minHeight: 44, ...(level.hasCurrent ? { background: "var(--ai-soft)" } : null) }} aria-current={level.hasCurrent ? "true" : undefined}>
                {done ? (
                  <Egg size="xs" state="done"><Ic name="check" /><span className="sr-only">Tuntas:</span></Egg>
                ) : level.hasCurrent ? (
                  <Egg size="xs" state="current">{level.number}<span className="sr-only">, aktif:</span></Egg>
                ) : (
                  <Egg size="xs">{level.number}</Egg>
                )}
                <span className={cn("li-title grow t-clamp-2", level.hasCurrent && "t-strong")}>{level.anchor && level.anchor !== `level-${level.number}` ? `${level.curriculumTitle} · ` : ""}L{level.number} · {level.name}</span>
                <span className={cn("t-caption t-num", level.hasCurrent ? "t-ai t-strong" : "t-muted")}>{level.completed}/{level.total}</span>
              </a>
            );
          })}
        </div>
      </nav>
      {nextTier ? (
        <Link className="reward anim-rise" to="/certification" data-hue="teal" style={{ "--i": 3 }}>
          <span className="tile tile-round tile-solid"><Ic name="cert" /></span>
          <div className="stack grow gap-1-5" style={{ minWidth: 0 }}>
            <span className="t-overline t-ink">Tingkat berikutnya</span>
            <span className="t-heading">Tingkat {nextTier.number} · {nextTier.name}</span>
            <Bar value={(tierDone / nextTier.modules.length) * 100} onTint animate label={`Progres Tingkat ${nextTier.number}`} now={tierDone} max={nextTier.modules.length} />
            <span className="t-caption t-muted">{nextTier.modules.length - tierDone ? `${nextTier.modules.length - tierDone} modul lagi` : "Siap diklaim"} · +150 poin saat diklaim</span>
          </div>
        </Link>
      ) : null}
      <section className="card card-pad stack gap-3 anim-rise" style={{ "--i": 4 }} aria-labelledby="legend-title">
        <h2 className="t-heading" id="legend-title">Arti telur di jalur</h2>
        <ul className="cols-2" style={{ gap: "var(--s-3) var(--s-4)" }}>
          <li className="row gap-2"><Egg size="xs" state="done" aria-hidden="true"><Ic name="check" /></Egg><span className="t-support">Tuntas</span></li>
          <li className="row gap-2"><Egg size="xs" state="current" aria-hidden="true">5</Egg><span className="t-support">Dipelajari</span></li>
          <li className="row gap-2"><Egg size="xs" aria-hidden="true">6</Egg><span className="t-support">Belum mulai</span></li>
          <li className="row gap-2"><Egg size="xs" state="gold" aria-hidden="true"><Ic name="award" /></Egg><span className="t-support">Hadiah tingkat</span></li>
        </ul>
      </section>
    </aside>
  );
}

function Catalog({ curriculum }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const term = query.trim().toLowerCase();
  const modules = useMemo(() => curriculum
    .filter((item) => level === "all" || String(item.number) === level)
    .flatMap((item) => item.modules)
    .filter((module) => matchesStatus(module, status))
    .filter((module) => !term || [module.title, module.summary, module.category, module.levelName]
      .some((value) => String(value || "").toLowerCase().includes(term))), [curriculum, level, status, term]);
  const visible = modules.slice(0, limit);
  const reset = () => { setQuery(""); setLevel("all"); setStatus("all"); setLimit(PAGE_SIZE); };

  return (
    <>
      <div className="toolbar" role="search" aria-label="Saring modul">
        <label className="search" style={{ flex: "1 1 240px", maxWidth: 340 }}>
          <Ic name="search" size="sm" />
          <span className="sr-only">Cari modul</span>
          <input type="search" placeholder="Cari modul…" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} />
        </label>
        <label className="sr-only" htmlFor="f-level">Level</label>
        <select className="select" id="f-level" style={{ width: 220 }} value={level} onChange={(event) => { setLevel(event.target.value); setLimit(PAGE_SIZE); }}>
          <option value="all">Semua level</option>
          {learningLevels.map((item) => <option key={item.number} value={String(item.number)}>Level {item.number} · {item.name}</option>)}
        </select>
        <div className="scroll-x" style={{ maxWidth: "100%" }}>
          <div className="seg" role="group" aria-label="Status modul">
            {statusFilters.map((filter) => (
              <button key={filter.value} type="button" className={status === filter.value ? "is-on" : undefined} aria-pressed={status === filter.value} onClick={() => { setStatus(filter.value); setLimit(PAGE_SIZE); }}>{filter.label}</button>
            ))}
          </div>
        </div>
        <span className="t-support t-muted t-num ml-auto" aria-live="polite">{modules.length} modul</span>
      </div>

      <section className="stack gap-6" aria-labelledby="grid-title">
        <h2 className="sr-only" id="grid-title">Daftar modul</h2>
        {visible.length ? (
          <div className="grid-lg">
            {visible.map((module, index) => <CourseCard key={module.moduleNumber} module={module} state={module.state} index={index} />)}
          </div>
        ) : (
          <div className="card card-dashed empty">
            <span className="tile tile-round" data-hue="neutral"><Ic name="search" /></span>
            <h3 className="t-heading">Modul tidak ditemukan</h3>
            <p className="t-support">Coba kata kunci lain atau tampilkan semua level.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Atur ulang filter</button>
          </div>
        )}
        {modules.length > visible.length ? (
          <div className="stack items-center gap-3">
            <span className="t-support t-muted t-num">Menampilkan {visible.length} dari {modules.length} modul</span>
            <button className="btn btn-secondary" type="button" onClick={() => setLimit(modules.length)}><Ic name="chev-down" />Muat {modules.length - visible.length} modul lagi</button>
          </div>
        ) : null}
      </section>
    </>
  );
}

/** Learning path (canvas "Jalur belajar" and "Katalog modul"). */
export default function Modules() {
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const [view, setView] = useState(readView);
  const isLoading = modulesLoading || progressLoading;
  const isError = modulesError || progressError;

  const summary = getProgressSummary(modules, progress);
  const completedSet = useMemo(() => getCompletedModuleSet(progress, modules), [progress, modules]);
  const nextModule = getNextModule(modules, progress);
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const levelsDone = curriculum.filter((level) => level.total && level.completed === level.total).length;
  const ownedTiers = useMemo(() => new Set((Array.isArray(certificates) ? certificates : [])
    .filter((item) => item?.status !== "revoked")
    .map((item) => Number(item.levelNumber ?? item.tierNumber))), [certificates]);

  const changeView = (next) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Optional preference.
    }
  };

  return (
    <Page>
      <header className="ph">
        <div className="ph-copy">
          <h1 className="ph-title">Jalur belajar</h1>
          <p className="ph-desc">Kuasai keputusan farm bertahap — dari fondasi flock sampai kepemimpinan operasional.</p>
        </div>
        <div className="ph-actions">
          <div className="seg" role="group" aria-label="Tampilan kurikulum">
            <button type="button" className={view === "path" ? "is-on" : undefined} aria-pressed={view === "path"} onClick={() => changeView("path")}><Ic name="route" />Jalur</button>
            <button type="button" className={view === "catalog" ? "is-on" : undefined} aria-pressed={view === "catalog"} onClick={() => changeView("catalog")}><Ic name="grid" />Katalog</button>
          </div>
        </div>
      </header>

      {isError ? (
        <LearningErrorState
          title="Jalur belajar belum dapat dimuat"
          description="Kurikulum atau progres Anda belum berhasil diambil. Coba lagi untuk melihat status terbaru."
          onRetry={() => { refetchModules(); refetchProgress(); }}
        />
      ) : isLoading ? (
        <LearningLoading label="Memuat jalur belajar…" lines={4} />
      ) : !modules.length ? (
        <LearningEmptyState title="Jalur belajar sedang disiapkan" description="Kurikulum akan tampil saat materi sudah dipublikasikan." actionLabel={null} actionTo={null} />
      ) : view === "path" ? (
        <>
          {nextModule ? <ContinueCard module={nextModule} summary={summary} levelsDone={levelsDone} levelTotal={learningLevels.length} /> : null}
          <div className="split">
            <LearningPath curriculum={curriculum} completedSet={completedSet} ownedTiers={ownedTiers} />
            <PathRail curriculum={curriculum} completedSet={completedSet} ownedTiers={ownedTiers} />
          </div>
        </>
      ) : (
        <Catalog curriculum={curriculum} />
      )}
    </Page>
  );
}
