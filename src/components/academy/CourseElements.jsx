import React from "react";
import { Link } from "react-router-dom";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, Button, ProgressRing, Segments } from "@/design-system";
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

/** Collapsible level in the learning path (Radix accordion item). */
export function LevelSection({ level }) {
  return (
    <AccordionPrimitive.Item value={`level-${level.number}`} id={`level-${level.number}`} className="aapm-level" data-hue={level.hue} data-current={level.hasCurrent ? "true" : undefined}>
      <AccordionPrimitive.Header asChild>
        <h3 className="m-0">
          <AccordionPrimitive.Trigger className="aapm-level__header">
            <ProgressRing value={level.percent} size={48} stroke={5} hue={level.hue} label={`Level ${level.number} ${level.percent}%`}>
              <AapmIcon name={level.icon} />
            </ProgressRing>
            <span className="min-w-0">
              <span className="aapm-text-overline block">Level {level.number}</span>
              <span className="aapm-level__title block">{level.name}</span>
              {level.description ? <span className="aapm-level__description block">{level.description}</span> : null}
            </span>
            <span className="aapm-level__aside">
              <Badge hue={level.percent === 100 ? undefined : level.hue} tone={level.percent === 100 ? "success" : undefined} icon={level.percent === 100 ? "check" : undefined}>
                {level.completed}/{level.total} modul
              </Badge>
              <AapmIcon name="chevronDown" className="aapm-accordion-chevron" />
            </span>
          </AccordionPrimitive.Trigger>
        </h3>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="aapm-accordion-content">
        <div className="aapm-level__modules">
          {level.modules.map((module) => <ModuleRow key={module.moduleNumber} module={module} state={module.state} hue={level.hue} />)}
        </div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
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
export function StatTile({ icon, hue = "green", label, value, className }) {
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
  const steps = [
    { id: "content", label: "Materi", icon: "lesson", state: active === "content" ? "current" : "done" },
    ...(flow.hasPractice ? [{ id: "practice", label: "Praktik", icon: "practice", state: active === "practice" ? "current" : active === "content" ? undefined : "done" }] : []),
    ...(flow.hasQuiz ? [{ id: "quiz", label: flow.quizAttempted ? `Kuis ${flow.quizPercent}%` : "Kuis", icon: "quiz", state: flow.quizPassed ? "done" : active === "quiz" ? "current" : undefined, to: quizTo }] : []),
    { id: "done", label: "Selesai", icon: "check", state: flow.completed ? "done" : undefined },
  ];
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
