import React from "react";
import { cn } from "@/lib/utils";
import { Ic } from "@/design-system/canvas";

/**
 * Where a learner stands in one module, from its progress row:
 * Materi → Praktik → Kuis → Selesai. Steps the module does not have are left out.
 */
export function moduleFlowSteps({ progress, hasPractice = true, hasQuiz = true }) {
  const completed = Boolean(progress?.completed);
  const done = {
    material: completed || Boolean(progress?.acknowledged) || Boolean(progress?.quizAttempted) || Number(progress?.quizTotal) > 0 || Boolean(progress?.practicalDone),
    practice: completed || Boolean(progress?.practicalDone),
    quiz: completed || Boolean(progress?.quizPassed),
  };
  const steps = [
    { key: "material", label: "Materi" },
    ...(hasPractice ? [{ key: "practice", label: "Praktik" }] : []),
    ...(hasQuiz ? [{ key: "quiz", label: "Kuis" }] : []),
  ];
  // Practice can be logged any time and never blocks the quiz, so the
  // current step skips a pending practice once the material is read.
  const firstOpen = steps.find((step) => !done[step.key] && !(step.key === "practice" && done.material && hasQuiz));
  return [
    ...steps.map((step) => ({ ...step, state: done[step.key] ? "done" : firstOpen?.key === step.key ? "current" : "todo" })),
    { key: "finish", label: "Selesai", state: completed ? "done" : !firstOpen ? "current" : "todo" },
  ];
}

/** The canvas `.flow` stepper. */
export default function FlowSteps({ steps, className = undefined, style = undefined, label = "Alur modul" }) {
  return (
    <div className={cn("flow", className)} aria-label={label} role="list" style={style}>
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          {index > 0 ? <span className={cn("flow-line", steps[index - 1].state === "done" && "is-done")} aria-hidden="true" /> : null}
          <span className={cn("flow-step", step.state === "done" && "is-done", step.state === "current" && "is-current")} role="listitem" aria-current={step.state === "current" ? "step" : undefined}>
            <span className="flow-dot">{step.state === "done" || step.key === "finish" ? <Ic name="check" /> : index + 1}</span>
            <span className="flow-label">{step.label}</span>
            {step.state === "done" ? <span className="sr-only">, selesai</span> : null}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
