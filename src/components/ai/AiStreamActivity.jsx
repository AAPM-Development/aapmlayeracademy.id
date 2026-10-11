import React from "react";
import { Ic } from "@/design-system/canvas";

/**
 * APPI at work (canvas "menelaah…" card): three orange dots, what APPI is
 * doing, a "langsung" chip and the last steps with their status.
 */
export default function AiStreamActivity({
  label,
  steps = [],
  compact = false,
  showSteps = true,
}) {
  const timeline = showSteps
    ? [...new Set(steps.map((step) => String(step).trim()).filter(Boolean))].slice(compact ? -2 : -3)
    : [];
  const activeLabel = label || "APPI menyiapkan jawaban…";
  const cleanStep = (step) => step.replace(/^APPI\s+/i, "");

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
        <ul className="stack gap-1-5">
          {timeline.map((step, index) => {
            const activeStep = index === timeline.length - 1;
            return (
              <li key={`${step}-${index}`} className="row gap-2 t-support">
                <Ic name={activeStep ? "refresh" : "check-circle"} size="sm" className={activeStep ? "t-ai" : "t-success"} />
                <span>{cleanStep(step)}</span>
              </li>
            );
          })}
        </ul>
      ) : !compact ? (
        <span className="t-caption t-muted">Respons ditampilkan bertahap dan disimpan ke riwayat akun setelah selesai.</span>
      ) : null}
    </div>
  );
}
