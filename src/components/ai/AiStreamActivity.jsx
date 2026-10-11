import React from "react";
import { Ic } from "@/design-system/canvas";

/** Steps arrive as { label, detail }; older answers stored plain strings. */
export function normalizeStep(step) {
  if (step && typeof step === "object") return { label: String(step.label || "").trim(), detail: String(step.detail || "").trim() };
  return { label: String(step || "").replace(/^APPI\s+/i, "").trim(), detail: "" };
}

/**
 * APPI at work (canvas "lagi berpikir…" card): three orange dots, what APPI is
 * doing right now, a "langsung" chip and the last steps with what each read.
 */
export default function AiStreamActivity({
  label,
  steps = [],
  compact = false,
  showSteps = true,
}) {
  const timeline = showSteps
    ? steps.map(normalizeStep).filter((step) => step.label).slice(compact ? -2 : -3)
    : [];
  const activeLabel = label || "APPI lagi berpikir…";

  return (
    <div className={`card card-pad-sm stack gap-3 aapm-ai-activity${compact ? " aapm-ai-activity--compact" : ""}`} style={{ justifySelf: "start", alignSelf: "flex-start", maxWidth: "100%" }}>
      <div className="row wrap gap-3">
        <span className="row gap-1" aria-hidden="true">
          <i className="anim-twinkle ai-dot" />
          <i className="anim-twinkle ai-dot" style={{ "--i": 1 }} />
          <i className="anim-twinkle ai-dot" style={{ "--i": 2 }} />
        </span>
        <span className="t-support t-strong">{activeLabel}</span>
        <span className="chip chip-ai chip-dot">langsung</span>
      </div>
      {timeline.length > 0 ? (
        <ul className="stack gap-2">
          {timeline.map((step, index) => {
            const activeStep = index === timeline.length - 1;
            return (
              <li key={`${step.label}-${index}`} className="row-start gap-2 t-support">
                <Ic name={activeStep ? "refresh" : "check-circle"} size="sm" className={activeStep ? "t-ai" : "t-success"} style={{ marginTop: 2 }} />
                <span className="stack" style={{ minWidth: 0 }}>
                  <span className="t-medium">{step.label}</span>
                  {step.detail ? <span className="t-caption t-muted">{step.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : !compact ? (
        <span className="t-caption t-muted">Jawaban muncul bertahap dan tersimpan di riwayat akunmu setelah selesai.</span>
      ) : null}
    </div>
  );
}
