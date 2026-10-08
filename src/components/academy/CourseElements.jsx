import React from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, Button, IconTile, Progress, Segments } from "@/design-system";
import { estimateMinutes, levelVisual, moduleVisual } from "@/lib/academyVisuals";
import { cn } from "@/lib/utils";

const stateLabel = {
  completed: "Selesai",
  current: "Sedang dipelajari",
  available: "Tersedia",
  locked: "Terkunci",
};

/** Colourful module/level artwork: hue tint, white badge icon, large number. */
export function ModuleCover({ module, level, number, size, state, className, children }) {
  const visual = module ? moduleVisual(module) : levelVisual(level);
  const label = number ?? module?.moduleNumber;
  return (
    <div className={cn("aapm-cover", className)} data-hue={visual.hue} data-size={size} data-state={state} aria-hidden="true">
      <span className="aapm-cover__badge"><AapmIcon name={visual.icon} /></span>
      {label !== undefined && label !== null ? <span className="aapm-cover__number">{String(label).padStart(2, "0")}</span> : null}
      {children}
    </div>
  );
}

/** Catalog card for a module (cover, level chip, title, summary, meta). */
export function CourseCard({ module, state = "available", to }) {
  const visual = moduleVisual(module);
  return (
    <Link to={to || `/modules/${module.moduleNumber}`} className="aapm-course-card" data-state={state}>
      <ModuleCover module={module} state={state === "locked" ? "locked" : undefined}>
        {state === "completed" ? <Badge className="aapm-cover__state" tone="solid" icon="check">Selesai</Badge> : null}
        {state === "current" ? <Badge className="aapm-cover__state" tone="attention" dot>Lanjutkan</Badge> : null}
      </ModuleCover>
      <div className="aapm-course-card__body">
        <div className="aapm-course-card__chips">
          <Badge hue={visual.hue}>Level {module.level}</Badge>
          {module.category ? <Badge>{module.category}</Badge> : null}
        </div>
        <h3 className="aapm-course-card__title">{module.title}</h3>
        {module.summary ? <p className="aapm-course-card__summary">{module.summary}</p> : null}
        <div className="aapm-course-card__meta">
          <span><AapmIcon name="clock" /> ±{estimateMinutes(module)} menit</span>
          {module.videoUrl ? <span><AapmIcon name="video" /> Video</span> : null}
          {module.practicalAssignment ? <span><AapmIcon name="practice" /> Praktik</span> : null}
        </div>
      </div>
    </Link>
  );
}

/** Compact row for path lists: numbered hue badge, title, meta, action. */
export function ModuleRow({ module, state = "available", hue }) {
  const resolvedHue = hue || moduleVisual(module).hue;
  return (
    <Link
      to={`/modules/${module.moduleNumber}`}
      className="aapm-module-row"
      data-state={state}
      data-hue={resolvedHue}
      aria-label={`Modul ${module.moduleNumber}: ${module.title}. ${stateLabel[state] || ""}`}
    >
      <span className="aapm-module-row__index" aria-hidden="true">
        {state === "completed" ? <AapmIcon name="glyphCheck" /> : state === "locked" ? <AapmIcon name="lock" /> : module.moduleNumber}
      </span>
      <span className="min-w-0">
        <span className="aapm-module-row__title">{module.title}</span>
        <span className="aapm-meta-row">
          <span className="aapm-meta"><AapmIcon name="clock" />±{estimateMinutes(module)} mnt</span>
          {module.progress?.quizTotal ? (
            <span className="aapm-meta"><AapmIcon name="quiz" />Kuis {Math.round(((module.progress.quizScore || 0) / module.progress.quizTotal) * 100)}%</span>
          ) : null}
          {state === "current" ? <span className="aapm-meta aapm-module-row__hint">Lanjutkan di sini</span> : null}
        </span>
      </span>
      <span className="aapm-module-row__action" aria-hidden="true">
        <AapmIcon name={state === "completed" ? "refresh" : "play"} />
      </span>
    </Link>
  );
}

const trackNodeIcon = { completed: "glyphCheck", locked: "lock" };

/** One module on a level's track: state node on the rail, title, meta. */
function TrackModule({ module }) {
  const state = module.state || "available";
  const quizPercent = module.progress?.quizTotal
    ? Math.round(((module.progress.quizScore || 0) / module.progress.quizTotal) * 100)
    : null;
  return (
    <li className="aapm-track__item" data-state={state}>
      <Link
        to={`/modules/${module.moduleNumber}`}
        className="aapm-track__row"
        aria-label={`Modul ${module.moduleNumber}: ${module.title}. ${stateLabel[state] || ""}`}
        aria-current={state === "current" ? "step" : undefined}
      >
        <span className="aapm-track__node" aria-hidden="true">
          {trackNodeIcon[state] ? <AapmIcon name={trackNodeIcon[state]} /> : module.moduleNumber}
        </span>
        <span className="aapm-track__body" aria-hidden="true">
          <span className="aapm-track__eyebrow">
            Modul {module.moduleNumber}
            {state === "current" ? <span className="aapm-track__now">{module.progress ? "Lanjutkan di sini" : "Mulai di sini"}</span> : null}
          </span>
          <span className="aapm-track__title">{module.title}</span>
        </span>
        <span className="aapm-track__meta aapm-meta-row" aria-hidden="true">
          <span className="aapm-meta"><AapmIcon name="clock" />±{estimateMinutes(module)} mnt</span>
          {quizPercent !== null ? <span className="aapm-meta"><AapmIcon name="quiz" />Kuis {quizPercent}%</span> : null}
          {module.progress?.practicalDone ? <span className="aapm-meta"><AapmIcon name="practice" />Praktik</span> : null}
        </span>
        <AapmIcon name="chevronRight" className="aapm-track__chevron" />
      </Link>
    </li>
  );
}

/** A level card: a tinted unit band (level, name, progress) over its modules. */
function LevelTrack({ level }) {
  const titleId = `track-level-${level.number}`;
  const done = level.percent === 100;
  return (
    <section id={`level-${level.number}`} className="aapm-track" data-hue={level.hue} data-current={level.hasCurrent ? "true" : undefined} aria-labelledby={titleId}>
      <header className="aapm-track__unit">
        <IconTile className="aapm-track__icon" icon={level.icon} hue={level.hue} size="md" shape="circle" variant="badge" />
        <div className="aapm-track__unit-copy">
          <p className="aapm-text-overline aapm-track__level">
            Level {level.number}
            {level.hasCurrent ? <Badge tone="attention" dot>Aktif</Badge> : done ? <Badge tone="success" icon="check">Tuntas</Badge> : null}
          </p>
          <h3 id={titleId} className="aapm-track__unit-title">{level.name}</h3>
          {level.description ? <p className="aapm-track__unit-text">{level.description}</p> : null}
        </div>
        <div className="aapm-track__unit-progress">
          <span className="aapm-numeric">{level.completed}/{level.total} modul</span>
          <Progress value={level.percent} label={`Progress ${level.name}`} />
        </div>
      </header>
      <ol className="aapm-track__list">
        {level.modules.map((module) => <TrackModule key={module.moduleNumber} module={module} />)}
      </ol>
    </section>
  );
}

/**
 * Learning track: every level as a card with a tinted unit band over a
 * vertical rail of its modules. The journey cues of a learning path (nodes on
 * a rail, the rail filling behind finished modules, the current step
 * highlighted) laid out on the page grid so the whole curriculum stays
 * scannable on desktop and phones.
 */
export function LearningPath({ curriculum = [] }) {
  return (
    <div className="aapm-tracks">
      {curriculum.map((level) => <LevelTrack key={level.number} level={level} />)}
    </div>
  );
}

/** "Continue learning" card with thumbnail, lesson meta and section progress. */
export function ContinueCard({ module, completedModules = 0, totalModules = 0, title = "Lanjutkan belajar" }) {
  if (!module) return null;
  const visual = moduleVisual(module);
  return (
    <section className="aapm-continue" data-hue={visual.hue} aria-label={title}>
      <ModuleCover module={module} />
      <div className="min-w-0">
        <p className="aapm-text-overline aapm-continue__eyebrow">
          Modul {module.moduleNumber} · {module.levelName || module.category}
        </p>
        <h3 className="aapm-continue__title">{module.title}</h3>
        <div className="aapm-continue__progress">
          <Segments total={Math.min(totalModules, 22)} current={completedModules} label="Progress course" />
          <span>{completedModules}/{totalModules}</span>
        </div>
      </div>
      <div>
        <Button asChild variant="learn">
          <Link to={`/modules/${module.moduleNumber}`}>{completedModules ? "Lanjutkan" : "Mulai belajar"}<AapmIcon name="arrowRight" /></Link>
        </Button>
      </div>
    </section>
  );
}

/** Stat tile with a colourful icon circle (score, streak, lessons…). */
export function StatTile({ icon, hue = "green", label, value, className = undefined }) {
  return (
    <div className={cn("aapm-stat", className)} data-hue={hue}>
      <span className="aapm-stat__icon" aria-hidden="true"><AapmIcon name={icon} /></span>
      <span className="aapm-stat__copy">
        <span className="aapm-stat__label">{label}</span>
        <span className="aapm-stat__value">{value}</span>
      </span>
    </div>
  );
}

/**
 * Bounded module flow: Materi → Praktik → Kuis → Selesai. Steps are derived
 * from module content and saved progress; nothing here changes the contract.
 */
export function ModuleFlow({ flow, active = "content", onSelect, quizTo }) {
  const practiceDone = flow.completed || flow.practicalDone || flow.quizAttempted;
  const draft = [
    { id: "content", label: "Materi", icon: "lesson", done: flow.completed || practiceDone || active !== "content" },
    ...(flow.hasPractice ? [{ id: "practice", label: "Praktik", icon: "practice", done: practiceDone }] : []),
    // A passed quiz shows its tick; the score only matters while a retake is due
    // (a done "Kuis 100%" also truncated to "Kuis 10…" on phones).
    ...(flow.hasQuiz ? [{ id: "quiz", label: flow.quizAttempted && !flow.quizPassed && !flow.completed ? `Kuis ${flow.quizPercent}%` : "Kuis", icon: "quiz", done: flow.completed || flow.quizPassed, to: quizTo }] : []),
    { id: "done", label: "Selesai", icon: "check", done: flow.completed },
  ];
  // The current step is the first unfinished one, so a later tick never sits
  // beside an earlier step that still reads as "current".
  const currentIndex = draft.findIndex((step) => !step.done);
  const steps = draft.map((step, index) => ({ ...step, state: step.done ? "done" : index === currentIndex ? "current" : undefined }));
  return (
    <ol className="aapm-flow" aria-label="Alur modul">
      {steps.map((step, index) => {
        const content = (
          <>
            <span className="aapm-flow__dot">{step.state === "done" ? <AapmIcon name="glyphCheck" /> : index + 1}</span>
            <span className="aapm-flow__text">{step.label}</span>
          </>
        );
        return (
          <li key={step.id} className="min-w-0">
            {step.to ? (
              <Link to={step.to} className="aapm-flow__step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>{content}</Link>
            ) : onSelect && step.id !== "done" ? (
              <button type="button" className="aapm-flow__step w-full" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined} onClick={() => onSelect(step.id)}>{content}</button>
            ) : (
              <span className="aapm-flow__step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Lesson player outline: course progress + every module grouped by level. */
export function CourseOutline({ curriculum = [], currentNumber, completed = 0, total = 0, onNavigate }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <nav className="aapm-outline" aria-label="Kurikulum course">
      <div className="aapm-outline__course">
        <p className="aapm-text-overline">Layer Farm Academy</p>
        <div className="flex items-center justify-between gap-2">
          <p className="aapm-text-label">{completed}/{total} modul selesai</p>
          <span className="aapm-text-caption aapm-numeric">{percent}%</span>
        </div>
        <div className="aapm-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress course"><div className="aapm-progress__fill" style={{ width: `${percent}%` }} /></div>
      </div>
      {curriculum.map((level) => (
        <div key={level.number} data-hue={level.hue} className="grid gap-0.5">
          <p className="aapm-outline__level aapm-text-overline">L{level.number} · {level.name}</p>
          {level.modules.map((module) => {
            const current = Number(module.moduleNumber) === Number(currentNumber);
            return (
              <Link
                key={module.moduleNumber}
                to={`/modules/${module.moduleNumber}`}
                className="aapm-outline__item"
                data-state={module.state}
                aria-current={current ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="aapm-outline__mark" aria-hidden="true">
                  {module.state === "completed" ? <AapmIcon name="glyphCheck" /> : module.state === "locked" ? <AapmIcon name="lock" /> : module.moduleNumber}
                </span>
                <span className="aapm-outline__label">{module.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
