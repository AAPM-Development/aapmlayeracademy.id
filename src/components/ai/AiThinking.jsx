import React, { useEffect, useRef, useState } from "react";
import AiMarkdown from "./AiMarkdown";
import AiStreamActivity from "./AiStreamActivity";
import { Ic } from "@/design-system/canvas";

/** "4 dtk", "1 mnt 12 dtk": how long APPI thought before the first word. */
export function formatThinking(ms) {
  const seconds = Math.round((Number(ms) || 0) / 1000);
  if (seconds < 1) return "kurang dari 1 dtk";
  if (seconds < 60) return `${seconds} dtk`;
  return `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`;
}

function useElapsed(startedAt, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  return startedAt ? Math.max(0, now - startedAt) : 0;
}

/** Provider reasoning summary while it arrives: a short window on the newest line. */
function LiveReasoning({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [text]);
  return (
    <div ref={ref} className="appi-thinking-live t-support" role="region" aria-label="Penalaran APPI">
      <AiMarkdown content={text} compact />
    </div>
  );
}

/**
 * What APPI does before and while it answers, in the workspace and the quick
 * panel. Before the first word: the activity card with a running timer and any
 * reasoning summary the provider shares. Once text arrives: one quiet line
 * ("Berpikir selama 4 dtk") that opens the steps and the reasoning summary.
 */
export default function AiThinking({ message, label = "", steps = [], compact = false }) {
  const [open, setOpen] = useState(false);
  const waiting = Boolean(message.streaming && !message.content);
  const elapsed = useElapsed(message.startedAt, waiting);
  const reasoning = message.reasoningSummary || "";
  const processSteps = message.processSteps || [];

  if (waiting) {
    const activeLabel = label || "APPI menyiapkan jawaban…";
    return (
      <div className="stack gap-2" style={{ minWidth: 0 }}>
        <AiStreamActivity label={elapsed >= 3000 ? `${activeLabel} · ${formatThinking(elapsed)}` : activeLabel} steps={steps} compact={compact} showSteps={!compact} />
        {reasoning ? <LiveReasoning text={reasoning} /> : null}
      </div>
    );
  }

  // A local fallback reply did not come from a model; there is no thinking to show.
  const thought = !message.fallback && Boolean(reasoning || message.reasoningObserved || message.thinkingMs >= 1500 || processSteps.length);
  if (!thought) return null;
  const summary = message.streaming
    ? "Menulis jawaban…"
    : message.thinkingMs >= 1000
      ? `Berpikir selama ${formatThinking(message.thinkingMs)}`
      : "Proses APPI";
  return (
    <div className="stack gap-2" style={{ minWidth: 0 }}>
      <button type="button" className="btn btn-ghost btn-sm btn-quiet appi-thinking-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Ic name="sparkle" />{summary}<Ic name={open ? "chev-up" : "chev-down"} />
      </button>
      {open ? (
        <div className="appi-thinking-body stack gap-2 t-support">
          {processSteps.length ? (
            <ol className="stack gap-1" aria-label="Langkah APPI">
              {processSteps.map((step, index) => (
                <li key={`${index}-${step}`} className="row gap-2"><Ic name="check" size="xs" className="t-success" />{String(step).replace(/^APPI\s+/i, "")}</li>
              ))}
            </ol>
          ) : null}
          {reasoning ? <AiMarkdown content={reasoning} compact /> : null}
          {!reasoning && message.reasoningObserved ? <p className="t-caption t-muted">Model menalar sebelum menjawab; provider tidak membagikan ringkasan penalarannya.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
