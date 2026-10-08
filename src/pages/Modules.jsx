import React, { useMemo, useState } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Badge,
  PageHeader,
  ProgressRing,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  StateView,
  Button,
} from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";
import { ContinueCard, CourseCard, LevelSection } from "@/components/academy/CourseElements";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useModules, useUserProgress } from "@/lib/useCourseData";
import { getNextModule, getProgressSummary } from "@/lib/academyData";
import { buildCurriculum } from "@/lib/academyVisuals";

const VIEW_KEY = "aapm-modules-view";

function readView() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "catalog" ? "catalog" : "path";
  } catch {
    return "path";
  }
}

export default function Modules() {
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const [view, setView] = useState(readView);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const isLoading = modulesLoading || progressLoading;
  const isError = modulesError || progressError;

  const summary = getProgressSummary(modules, progress);
  const nextModule = getNextModule(modules, progress);
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const levelsDone = curriculum.filter((level) => level.percent === 100).length;
  const openLevel = curriculum.find((level) => level.hasCurrent) || curriculum[0];

  const normalizedQuery = query.trim().toLowerCase();
  const catalog = useMemo(() => curriculum
    .filter((level) => levelFilter === "all" || String(level.number) === levelFilter)
    .flatMap((level) => level.modules)
    .filter((module) => !normalizedQuery || [module.title, module.summary, module.category, module.levelName]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery))), [curriculum, levelFilter, normalizedQuery]);

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
      <PageHeader
        title="Layer Farm Academy"
        description="Kuasai keputusan farm bertahap — dari fondasi flock sampai kepemimpinan operasional."
        actions={<Badge size="lg" icon="modules">{modules.length || 22} modul · {curriculum.length || 14} level</Badge>}
      />

      {isError ? (
        <LearningErrorState
          title="Jalur belajar belum dapat dimuat"
          description="Roadmap atau progress Anda belum berhasil diambil. Coba lagi untuk melihat status terbaru."
          onRetry={() => { refetchModules(); refetchProgress(); }}
        />
      ) : isLoading ? (
        <LearningLoading label="Memuat jalur belajar…" lines={4} />
      ) : !modules.length ? (
        <LearningEmptyState title="Jalur belajar sedang disiapkan" description="Roadmap akan tampil saat materi sudah dipublikasikan." actionLabel={null} actionTo={null} />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" aria-label="Ringkasan belajar">
            {nextModule ? (
              <ContinueCard module={nextModule} completedModules={summary.completed} totalModules={summary.total} />
            ) : (
              <StateView kind="success" framed compact title="Semua modul selesai" description="Lanjutkan ke ujian akhir dan klaim sertifikat Anda." />
            )}
            <div className="aapm-card justify-center gap-4 p-4">
              <div className="flex items-center gap-4">
                <ProgressRing value={summary.percent} size={64} stroke={7} label={`Progress course ${summary.percent}%`} />
                <div className="grid min-w-0 gap-0.5">
                  <p className="aapm-text-overline m-0">Progress course</p>
                  <p className="aapm-text-section m-0 aapm-numeric">{summary.completed}/{summary.total} modul</p>
                </div>
              </div>
              <dl className="aapm-description-list">
                <div><dt>Level tuntas</dt><dd className="aapm-numeric">{levelsDone} dari {curriculum.length}</dd></div>
                <div><dt>Sisa modul</dt><dd className="aapm-numeric">{summary.total - summary.completed}</dd></div>
              </dl>
            </div>
          </section>

          <section aria-labelledby="curriculum-title">
            <SectionHeader
              id="curriculum-title"
              title={view === "path" ? "Kurikulum per level" : "Katalog modul"}
              description={view === "path" ? "Buka level untuk melihat modulnya. Level aktif ditandai." : "Cari dan saring modul berdasarkan level."}
              actions={(
                <SegmentedControl
                  label="Tampilan kurikulum"
                  value={view}
                  onChange={changeView}
                  options={[
                    { value: "path", label: "Path", icon: "roadmap" },
                    { value: "catalog", label: "Katalog", icon: "widget" },
                  ]}
                />
              )}
            />

            {view === "path" ? (
              <AccordionPrimitive.Root type="multiple" defaultValue={openLevel ? [`level-${openLevel.number}`] : []} className="grid gap-3">
                {curriculum.map((level) => <LevelSection key={level.number} level={level} />)}
              </AccordionPrimitive.Root>
            ) : (
              <div className="grid gap-4">
                <div className="aapm-toolbar">
                  <SearchInput className="max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari modul…" aria-label="Cari modul" />
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter level">
                    <Button size="sm" variant={levelFilter === "all" ? "soft" : "ghost"} aria-pressed={levelFilter === "all"} onClick={() => setLevelFilter("all")}>Semua</Button>
                    {curriculum.map((level) => (
                      <Button key={level.number} size="sm" variant={levelFilter === String(level.number) ? "soft" : "ghost"} aria-pressed={levelFilter === String(level.number)} onClick={() => setLevelFilter(String(level.number))}>
                        L{level.number}
                      </Button>
                    ))}
                  </div>
                </div>
                {catalog.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {catalog.map((module) => <CourseCard key={module.moduleNumber} module={module} state={module.state} />)}
                  </div>
                ) : (
                  <StateView kind="empty" icon="search" title="Modul tidak ditemukan" description="Coba kata kunci lain atau tampilkan semua level." action={<Button variant="secondary" onClick={() => { setQuery(""); setLevelFilter("all"); }}>Reset filter</Button>} />
                )}
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
