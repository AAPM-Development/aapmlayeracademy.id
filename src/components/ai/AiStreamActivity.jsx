import React, { useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";

export default function AiStreamActivity({
  label,
  steps = [],
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const timeline = steps.slice(-4);
  const activeLabel = label || "APPI menyiapkan jawaban";

  return (
    <div
      className={`aapm-ai-activity ${compact ? "aapm-ai-activity--compact" : ""}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="aapm-ai-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {activeLabel}
        </span>
        {!compact && timeline.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="shrink-0 text-[10px] font-semibold text-brand-orange hover:text-brand-orange/75"
          >
            {expanded ? "Sembunyikan" : "Aktivitas"}
          </button>
        )}
      </div>
      {expanded && (
        <ol className="mt-2.5 space-y-1.5 border-l border-border pl-3.5 text-[11px] text-muted-foreground">
          {timeline.map((step, index) => (
            <li key={`${step}-${index}`} className="relative">
              <AapmIcon
                name={
                  index === timeline.length - 1
                    ? "solar:refresh-circle-bold-duotone"
                    : "solar:check-circle-bold"
                }
                className={`absolute -left-[1.36rem] top-0.5 h-3 w-3 bg-background ${index === timeline.length - 1 ? "text-brand-orange" : "text-brand-green"}`}
              />
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
