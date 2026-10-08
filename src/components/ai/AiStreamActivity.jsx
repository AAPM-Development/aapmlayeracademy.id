import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

export default function AiStreamActivity({
  label,
  steps = [],
  compact = false,
  showSteps = true,
}) {
  const timeline = showSteps
    ? [...new Set(steps.map((step) => String(step).trim()).filter(Boolean))].slice(
        compact ? -2 : -3,
      )
    : [];
  const activeLabel = label || "APPI menyiapkan jawaban";
  const cleanStep = (step) => step.replace(/^APPI\s+/i, "");

  return (
    <div
      className={`aapm-ai-activity ${compact ? "aapm-ai-activity--compact" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="aapm-ai-activity__status">
          <span className="aapm-ai-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="aapm-ai-activity__copy">
            <span className="aapm-ai-activity__label">{activeLabel}</span>
            {!compact && (
              <span className="aapm-ai-activity__hint">
                Respons ditampilkan bertahap dan disimpan ke riwayat akun setelah selesai.
              </span>
            )}
          </span>
          <span className="aapm-ai-activity__live">
            <span aria-hidden="true" />
            langsung
          </span>
        </div>
        {timeline.length > 0 && (
          <ol className="aapm-ai-activity__steps">
            {timeline.map((step, index) => (
              <li
                key={`${step}-${index}`}
                className={`aapm-ai-activity__step ${index === timeline.length - 1 ? "aapm-ai-activity__step--active" : ""}`}
              >
                <AapmIcon
                  name={
                    index === timeline.length - 1
                      ? "solar:refresh-circle-bold-duotone"
                      : "solar:check-circle-bold"
                  }
                  className={`h-3 w-3 shrink-0 ${index === timeline.length - 1 ? "text-brand-orange" : "text-brand-green"}`}
                />
                <span>{cleanStep(step)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
