import React, { useState } from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AppiMascot from "@/components/appi/AppiMascot";
import { Bar, Egg, Ic, Ring } from "@/design-system/canvas";
import { certificationTiers } from "@/lib/academyData";
import { estimateMinutes, levelVisual, moduleVisual } from "@/lib/academyVisuals";
import { moduleMeta } from "@/lib/learnerCopy";
import { cn } from "@/lib/utils";
import { moduleNo } from "@/lib/moduleNumber";

// Course patterns of the Redesign v2 canvas (academy.css §16–17): covers,
// catalog cards, the egg path with tier rewards, and the lesson outline.

const stateLabel = {
  completed: "tuntas",
  current: "sedang dipelajari",
  available: "belum mulai",
  locked: "terkunci",
};

/**
 * Module/level artwork (`.cover`): hue tint, rings, white tile and the big number,
 * or the module's own banner image when the admin set one (see MODULE_COVER_TEMPLATE).
 */
export function ModuleCover({ module = undefined, level = undefined, number = undefined, size = undefined, state = undefined, className = undefined, style = undefined, children = undefined }) {
  const visual = module ? moduleVisual(module) : levelVisual(level);
  const label = number ?? moduleNo(module);
  const image = module ? visual.image : "";
  return (
    <div className={cn("cover", className)} data-hue={visual.hue} data-size={size} data-state={state} data-image={image ? "true" : undefined} style={{ borderRadius: 0, ...style }} aria-hidden="true">
      {image
        ? <img className="cover-img" src={image} alt="" loading="lazy" decoding="async" style={{ objectPosition: `center ${visual.focus}` }} />
        : <span className="tile"><Ic name={visual.ic} /></span>}
      {children}
      {!image && label !== undefined && label !== null ? <span className="cover-num">{String(label).padStart(2, "0")}</span> : null}
    </div>
  );
}

function quizPercentOf(module) {
  return module.progress?.quizTotal ? Math.round(((module.progress.quizScore || 0) / module.progress.quizTotal) * 100) : null;
}

/** Catalog card: cover with state chip, level chip, title, summary; time and reward in the foot. */
export function CourseCard({ module, state = "available", to = undefined, index = 0 }) {
  const visual = moduleVisual(module);
  const quiz = quizPercentOf(module);
  return (
    <Link
      to={to || `/modules/${module.moduleNumber}`}
      className="card card-tactile stack anim-rise"
      data-hue={visual.hue}
      style={{ overflow: "hidden", "--i": Math.min(index, 8) }}
      aria-current={state === "current" ? "step" : undefined}
    >
      <ModuleCover module={module} style={{ height: 112 }}>
        {state === "completed" ? <span className="chip chip-success cover-chip"><Ic name="check" />Selesai</span> : null}
        {state === "current" ? <span className="chip chip-ai chip-dot cover-chip">Lanjutkan</span> : null}
      </ModuleCover>
      <div className="stack grow gap-2 card-pad">
        <span className="chip chip-hue" style={{ alignSelf: "flex-start" }}>Chapter {module.level} · {module.levelName}</span>
        <h3 className="card-title t-clamp-2">{module.title}</h3>
        {module.summary ? <p className="t-support t-muted t-clamp-2">{module.summary}</p> : null}
      </div>
      <div className="card-foot" style={{ minHeight: 56 }}>
        <span className="row gap-1 t-caption t-muted"><Ic name="clock" size="xs" />±{estimateMinutes(module)} menit</span>
        {state === "completed" ? (
          <span className="row gap-1 t-caption t-success t-strong ml-auto"><Ic name="check-circle" size="xs" />{quiz !== null ? `Kuis ${quiz}%` : "Tuntas"}</span>
        ) : (
          <span className="xp ml-auto"><Ic name="star" />+100</span>
        )}
      </div>
    </Link>
  );
}

/** Compact list row (`.li`) with the module egg. */
export function ModuleRow({ module, state = "available", hue = undefined }) {
  const resolvedHue = hue || moduleVisual(module).hue;
  return (
    <Link
      to={`/modules/${module.moduleNumber}`}
      className="li"
      data-hue={resolvedHue}
      style={{ minHeight: 64, ...(state === "current" ? { background: "var(--ai-soft)" } : null) }}
      aria-label={`Modul ${moduleNo(module)}: ${module.title}, ${stateLabel[state] || ""}`}
    >
      <Egg size="xs" state={state === "completed" ? "done" : state === "current" ? "current" : undefined}>{state === "completed" ? <Ic name="check" /> : moduleNo(module)}</Egg>
      <span className="stack grow" style={{ minWidth: 0 }}>
        <span className="li-title t-clamp-1">{module.title}</span>
        <span className="li-meta">Chapter {module.level} · {moduleMeta(module, { short: true })}</span>
      </span>
      <Ic name="chev-right" className="t-muted" />
    </Link>
  );
}

/* ------------------------------------------------------------ Egg path */
// The path zig-zags like a course map: one smooth wave across all steps.
const waveX = (step) => Math.round(-Math.sin((step * Math.PI) / 4) * 96);

function tierState(tier, completedSet, ownedTiers) {
  const remaining = tier.modules.filter((number) => !completedSet.has(number));
  if (ownedTiers.has(tier.number)) return { kind: "owned", label: `Tingkat ${tier.number} · diraih` };
  if (!remaining.length) return { kind: "ready", label: `Tingkat ${tier.number} · siap diklaim` };
  if (remaining.length === 1) return { kind: "next", label: `Tingkat ${tier.number} · siap setelah Modul ${remaining[0]}` };
  return { kind: "later", label: `Tingkat ${tier.number} · ${remaining.length} modul lagi` };
}

function TierEgg({ tier, state, x }) {
  const name = `Tingkat ${tier.number} ${tier.name}`;
  return (
    <li className="path-step" style={{ "--x": x }}>
      <Link
        to="/certification"
        className={cn("egg", (state.kind === "owned" || state.kind === "ready") && "is-gold", state.kind === "ready" && "anim-pulse")}
        style={state.kind === "owned" || state.kind === "ready" ? undefined : { background: "var(--gold-soft)", color: "var(--gold-ink)", "--egg-ledge": "var(--gold-tint)" }}
        aria-label={`${name}, ${state.label.split(" · ")[1]}`}
      >
        <Ic name="award" />
        {state.kind === "owned" ? <span className="medal-badge"><Ic name="check" style={{ "--ic": "12px" }} /></span> : null}
      </Link>
      <span className="path-label">{state.label}</span>
    </li>
  );
}

function PathModule({ module, x, size, coach }) {
  const state = module.state || "available";
  return (
    <li className="path-step" style={{ "--x": x }}>
      <Link
        to={`/modules/${module.moduleNumber}`}
        className={cn("egg", size && `egg-${size}`, state === "completed" && "is-done", state === "current" && "is-current anim-pulse anim-pop")}
        aria-label={`Modul ${moduleNo(module)}: ${module.title}, ${stateLabel[state] || ""}`}
        aria-current={state === "current" ? "step" : undefined}
      >
        {state === "completed" ? <Ic name="check" /> : moduleNo(module)}
      </Link>
      <span className="path-label t-clamp-2">{state === "current" ? <span className="t-ai">{module.title}</span> : module.title}</span>
      {state === "current" && coach ? (
        <div className="appi-says hide-sm path-coach">
          <div className="appi-stage"><AppiMascot mood="wink" size="lg" enter="pop" /></div>
          <p className="bubble bubble-ai tail-left appi-say">{coach}</p>
        </div>
      ) : null}
    </li>
  );
}

function LevelSection({ level, index, steps, completedSet, ownedTiers }) {
  const done = level.total && level.completed === level.total;
  const titleId = `${level.anchor || `level-${level.number}`}-title`;
  const coach = level.modules.some((module) => module.state === "current")
    ? (level.modules.find((module) => module.state === "current")?.progress ? "Lanjutkan di sini!" : "Mulai di sini!")
    : null;
  const items = [];
  level.modules.forEach((module) => {
    items.push(<PathModule key={`m-${module.moduleNumber}`} module={module} x={waveX(steps.next())} size={done ? "sm" : undefined} coach={coach} />);
    certificationTiers
      .filter((tier) => Math.max(...tier.modules) === Number(module.moduleNumber))
      .forEach((tier) => items.push(<TierEgg key={`t-${tier.number}`} tier={tier} state={tierState(tier, completedSet, ownedTiers)} x={waveX(steps.next())} />));
  });
  return (
    <section className="stack gap-3 anim-rise" id={level.anchor || `level-${level.number}`} data-hue={level.hue} style={{ "--i": Math.min(index + 1, 8), scrollMarginTop: 24 }} aria-labelledby={titleId}>
      {level.curriculumStart ? <h2 className="t-overline t-muted" style={{ paddingTop: index ? "var(--s-4)" : 0 }}>Kurikulum · {level.curriculumTitle}</h2> : null}
      <div className="unit-banner">
        <span className="tile tile-lg hide-sm"><Ic name={level.ic} /></span>
        <div className="stack grow gap-0-5" style={{ minWidth: 0 }}>
          <span className="t-overline">Chapter {level.number}</span>
          <h2 className="unit-title" id={titleId}>{level.name}</h2>
          {level.description ? <p className="t-support t-clamp-1">{level.description}</p> : null}
        </div>
        <div className="stack items-end gap-1-5">
          {done ? <span className="chip"><Ic name="check" />Tuntas</span> : level.hasCurrent ? <span className="chip chip-ai chip-dot">Aktif</span> : null}
          <span className="t-caption t-strong t-num">{level.completed}/{level.total} modul</span>
        </div>
      </div>
      <ol className="path" style={done ? { gap: "var(--s-4)" } : undefined} aria-label={`Modul Chapter ${level.number}`}>
        {items}
      </ol>
    </section>
  );
}

/**
 * Learning path (canvas "Jalur belajar"): every level is a unit banner over
 * a zig-zag of eggs, with certificate tiers as gold eggs where they unlock.
 * Finished levels sit compact; levels after the next one fold into one card.
 */
export function LearningPath({ curriculum = [], completedSet = new Set(), ownedTiers = new Set() }) {
  const [expanded, setExpanded] = useState(false);
  const activeIndex = curriculum.findIndex((level) => level.hasCurrent);
  const visibleUntil = activeIndex < 0 ? curriculum.length : activeIndex + 2;
  const shown = expanded ? curriculum : curriculum.slice(0, visibleUntil);
  const folded = expanded ? [] : curriculum.slice(visibleUntil);
  let step = 0;
  const steps = { next: () => step++ };
  const foldedModules = folded.flatMap((level) => level.modules);
  return (
    <div className="stack gap-6">
      {shown.map((level, index) => (
        <LevelSection key={level.key || level.number} level={level} index={index} steps={steps} completedSet={completedSet} ownedTiers={ownedTiers} />
      ))}
      {folded.length ? (
        <section className="card card-dashed card-pad stack gap-4 anim-rise" style={{ "--i": 5 }} aria-labelledby="more-title">
          <div className="row wrap between gap-3">
            <div className="stack gap-0-5" style={{ flex: "1 1 240px", minWidth: 0 }}>
              <h2 className="t-heading" id="more-title">Chapter {folded[0].number}–{folded[folded.length - 1].number} · {foldedModules.length} modul berikutnya</h2>
              <p className="t-support t-muted">{folded[0].name} sampai {folded[folded.length - 1].name}.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" aria-expanded="false" onClick={() => setExpanded(true)}>Tampilkan semua<Ic name="chev-down" /></button>
          </div>
          <ol className="row wrap gap-2" aria-label={`Modul ${moduleNo(foldedModules[0])} sampai ${moduleNo(foldedModules[foldedModules.length - 1])}`}>
            {foldedModules.map((module) => (
              <li key={module.moduleNumber}>
                <Link to={`/modules/${module.moduleNumber}`} className={cn("egg egg-xs", module.state === "completed" && "is-done")} aria-label={`Modul ${moduleNo(module)}: ${module.title}, ${stateLabel[module.state] || ""}`}>
                  {module.state === "completed" ? <Ic name="check" /> : moduleNo(module)}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** Continue strip: the next module with one action, and the course numbers beside it. */
export function ContinueCard({ module, summary, levelsDone = 0, levelTotal = 14 }) {
  if (!module) return null;
  const visual = moduleVisual(module);
  return (
    <section className="card cover-row anim-rise" data-hue={visual.hue} aria-labelledby="cont-title">
      <ModuleCover module={module} style={{ minHeight: 112 }} />
      <div className="row wrap gap-5" style={{ padding: "var(--s-4) var(--s-5)", minWidth: 0 }}>
        <div className="stack grow gap-1" style={{ minWidth: 220 }}>
          <span className="t-overline t-ink">Modul {moduleNo(module)} · {module.levelName}</span>
          <h2 className="t-heading t-clamp-2" id="cont-title">{module.title}</h2>
          <span className="t-support t-muted">{moduleMeta(module)}</span>
        </div>
        <Link className="btn btn-learn btn-lg btn-block-sm" to={`/modules/${module.moduleNumber}`}>{summary.completed ? "Lanjutkan" : "Mulai belajar"}<Ic name="arrow-right" /></Link>
        <span className="vr hide-md" />
        <dl className="row wrap gap-5" aria-label="Ringkasan progres">
          <div className="row gap-3">
            <Ring value={summary.percent} hue="green" animate />
            <div className="stack"><dt className="t-caption t-muted">Progres</dt><dd className="t-heading t-num">{summary.completed}/{summary.total} modul</dd></div>
          </div>
          <div className="stack"><dt className="t-caption t-muted">Chapter tuntas</dt><dd className="t-heading t-num">{levelsDone} dari {levelTotal}</dd></div>
          <div className="stack"><dt className="t-caption t-muted">Sisa</dt><dd className="t-heading t-num">{summary.total - summary.completed} modul</dd></div>
        </dl>
      </div>
    </section>
  );
}

/** Metric tile (`.card.metric`) with a solid hue icon. */
export function StatTile({ icon, hue = "green", label, value, className = undefined }) {
  return (
    <div className={cn("card metric", className)} data-hue={hue}>
      <span className="metric-label"><span className="tile tile-sm tile-round tile-solid"><AapmIcon name={icon} /></span>{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

/** Lesson outline content: course progress, then every module grouped by level. */
export function CourseOutline({ curriculum = [], currentNumber, completed = 0, total = 0, onNavigate }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <>
      <div className="stack gap-2" style={{ padding: "4px 8px 12px", borderBottom: "1px solid var(--border)" }} data-hue="green">
        <span className="t-overline t-muted">Layer Farm Academy</span>
        <div className="row between"><span className="t-support t-strong">{completed}/{total} modul selesai</span><span className="t-caption t-muted t-num">{percent}%</span></div>
        <Bar value={percent} size="sm" label="Progres course" />
      </div>
      {curriculum.map((level) => (
        <div key={level.key || level.number} className="stack gap-1">
          {level.curriculumStart ? <span className="t-overline t-muted" style={{ padding: "8px 8px 0" }}>{level.curriculumTitle}</span> : null}
          <span className="row gap-2 t-caption t-strong" style={{ padding: "4px 8px" }} data-hue={level.hue}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--h)" }} aria-hidden="true" />C{level.number} · {level.name}</span>
          {level.modules.map((module) => {
            const current = Number(module.moduleNumber) === Number(currentNumber);
            const done = module.state === "completed";
            return (
              <Link
                key={module.moduleNumber}
                to={`/modules/${module.moduleNumber}`}
                className={cn("outline-item", done && "is-done", current && "is-current")}
                aria-current={current ? "page" : undefined}
                onClick={onNavigate}
              >
                <Egg size="xs" state={done ? "done" : current ? "current" : undefined}>{done ? <Ic name="check" /> : moduleNo(module)}</Egg>
                <span className="t-clamp-2">{module.title}</span>
                {done ? <span className="sr-only">, tuntas</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
