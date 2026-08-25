import React from "react";
import AiAvatar from "@/components/ai/AiAvatar";
import AiStreamActivity from "@/components/ai/AiStreamActivity";

/**
 * A single, persistent APPI companion for a chat surface.
 *
 * It deliberately lives outside the scrolling transcript: APPI remains at the
 * base of the workspace while the conversation scrolls behind a soft canvas
 * fade, in the same way a coding/chat workspace keeps its activity grounded.
 */
export default function AiCompanionDock({
  streaming = false,
  state = "idle",
  label,
  steps = [],
  compact = false,
}) {
  return (
    <div
      className={`aapm-ai-companion-dock ${compact ? "aapm-ai-companion-dock--compact" : ""} ${streaming ? "aapm-ai-companion-dock--streaming" : ""}`}
      aria-live={streaming ? "polite" : undefined}
    >
      <div className="aapm-ai-companion-dock__inner">
        <AiAvatar
          size={compact ? "sm" : "md"}
          state={state}
          decorative
          className="aapm-ai-companion-dock__avatar"
        />
        {streaming && (
          <AiStreamActivity
            label={label}
            steps={steps}
            compact={compact}
            showSteps={false}
          />
        )}
      </div>
    </div>
  );
}
