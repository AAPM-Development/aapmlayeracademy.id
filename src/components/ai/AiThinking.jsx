import React, { useEffect, useRef, useState } from "react";
import AiMarkdown from "./AiMarkdown";
import AiStreamActivity, { normalizeStep } from "./AiStreamActivity";
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
    <div ref={ref} className="appi-thinking-live t-support" role="region" aria-label="Yang APPI pikirkan">
      <AiMarkdown content={text} compact />
    </div>
  );
}

/**
 * What APPI does before and while it answers, in the workspace and the quick
 * panel. Before the first word: the live card ("APPI lagi berpikir…") with a timer,
 * the latest steps and any reasoning the provider shares. Once text arrives:
 * one quiet line ("APPI berpikir selama 4 dtk") that opens the full trail: every
 * step with what it read, then what APPI was thinking.
 */
export default function AiThinking({ message, label = "", steps = [], compact = false }) {
  const [open, setOpen] = useState(false);
  const waiting = Boolean(message.streaming && !message.content);
  const elapsed = useElapsed(message.startedAt, waiting);
  const reasoning = message.reasoningSummary || "";
  const trail = (message.processSteps || []).map(normalizeStep).filter((step) => step.label);

  if (waiting) {
    const activeLabel = label || "APPI lagi berpikir…";
    return (
      <div className="stack gap-2" style={{ minWidth: 0 }}>
        <AiStreamActivity label={elapsed >= 3000 ? `${activeLabel} · ${formatThinking(elapsed)}` : activeLabel} steps={steps} compact={compact} showSteps={!compact} />
        {reasoning ? <LiveReasoning text={reasoning} /> : null}
      </div>
    );
  }

  // A local fallback reply did not come from a model; there is no thinking to show.
  const thought = !message.fallback && Boolean(reasoning || message.reasoningObserved || message.thinkingMs >= 1500 || trail.length);
  if (!thought) return null;
  const summary = message.streaming
    ? "APPI lagi menulis jawaban…"
    : message.thinkingMs >= 1000
      ? `APPI berpikir selama ${formatThinking(message.thinkingMs)}`
      : "Lihat cara APPI berpikir";
  return (
    <div className="stack gap-2" style={{ minWidth: 0 }}>
      <button type="button" className="btn btn-ghost btn-sm btn-quiet appi-thinking-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Ic name="sparkle" />{summary}<Ic name={open ? "chev-up" : "chev-down"} />
      </button>
      {open ? (
        <div className="appi-thinking-body stack gap-3 t-support">
          {trail.length ? (
            <section className="stack gap-2" aria-label="Langkah APPI">
              <h4 className="t-overline t-muted">Yang APPI lakukan</h4>
              <ol className="appi-thinking-steps stack gap-2">
                {trail.map((step, index) => (
                  <li key={`${index}-${step.label}`} className="row-start gap-2">
                    <span className="appi-thinking-step-dot" aria-hidden="true"><Ic name="check" size="xs" /></span>
                    <span className="stack" style={{ minWidth: 0 }}>
                      <span className="t-medium">{step.label}</span>
                      {step.detail ? <span className="t-caption t-muted">{step.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <section className="stack gap-1" aria-label="Yang APPI pikirkan">
            <h4 className="t-overline t-muted">Yang APPI pikirkan</h4>
            {reasoning ? (
              <AiMarkdown content={reasoning} compact />
            ) : (
              <p className="t-caption t-muted">
                {message.reasoningObserved
                  ? "APPI sempat menimbang jawaban dulu, tapi provider tidak membagikan isi pemikirannya."
                  : "Model ini langsung menjawab dari konteks di atas tanpa ringkasan pemikiran terpisah."}
              </p>
            )}
          </section>
          {message.thinkingMs >= 1000 ? (
            <p className="t-caption t-muted row gap-1"><Ic name="clock" size="xs" />Mulai menjawab setelah {formatThinking(message.thinkingMs)}.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
