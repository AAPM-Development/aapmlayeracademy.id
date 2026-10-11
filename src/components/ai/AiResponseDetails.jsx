import React from "react";
import { Ic } from "@/design-system/canvas";

/** Whether an answer carries provider details worth showing (steps and reasoning live in AiThinking). */
export function hasResponseDetails(message) {
  if (!message || message.role !== "assistant" || message.fallback) return false;
  return Boolean(message.model || message.provider);
}

/** The collapsed "Detail respons" body: which model and provider answered. */
export function ResponseDetailsPanel({ message, compact = false }) {
  return (
    <div className="inset card-pad-sm stack gap-2 t-support aapm-ai-details" data-density={compact ? "compact" : undefined}>
      {message.model ? <span className="row gap-2"><span className="t-muted">Model</span><span className="t-mono t-clamp-1" title={message.model}>{message.model}</span></span> : null}
      {message.provider ? <span className="row gap-2"><span className="t-muted">Provider</span><span>{message.provider}</span></span> : null}
    </div>
  );
}

/** Toggle button for the details panel, shown in the answer's action row. */
export function ResponseDetailsToggle({ message, open, onToggle }) {
  if (!hasResponseDetails(message)) return null;
  return (
    <button type="button" className="btn btn-ghost btn-sm btn-quiet" aria-expanded={open} onClick={onToggle}>
      <Ic name="info" />{message.streaming ? "Aktivitas respons" : "Detail respons"}<Ic name={open ? "chev-up" : "chev-down"} />
    </button>
  );
}

/** Self-contained collapsible variant (quick panel). */
export default function AiResponseDetails({ message, compact = false }) {
  const [open, setOpen] = React.useState(false);
  if (!hasResponseDetails(message)) return null;
  return (
    <div className="stack gap-2">
      <div className="row"><ResponseDetailsToggle message={message} open={open} onToggle={() => setOpen((value) => !value)} /></div>
      {open ? <ResponseDetailsPanel message={message} compact={compact} /> : null}
    </div>
  );
}
