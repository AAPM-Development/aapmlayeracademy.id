import React from "react";
import AiMarkdown from "./AiMarkdown";
import { Ic } from "@/design-system/canvas";

/** Whether an answer carries provider details worth showing. */
export function hasResponseDetails(message) {
  if (!message || message.role !== "assistant" || message.fallback) return false;
  return Boolean(message.model || message.reasoningSummary || message.reasoningObserved || (message.processSteps || []).length);
}

/** The collapsed "Detail respons" body (model, provider, steps, reasoning summary). */
export function ResponseDetailsPanel({ message, compact = false }) {
  const steps = message.processSteps || [];
  return (
    <div className="inset card-pad-sm stack gap-2 t-support aapm-ai-details" data-density={compact ? "compact" : undefined}>
      {message.model ? <span className="row gap-2"><span className="t-muted">Model</span><span className="t-mono t-clamp-1" title={message.model}>{message.model}</span></span> : null}
      {message.provider ? <span className="row gap-2"><span className="t-muted">Provider</span><span>{message.provider}</span></span> : null}
      {steps.length > 0 ? <ol className="stack gap-1" aria-label="Aktivitas permintaan">{steps.map((step, index) => <li key={`${index}-${step}`} className="row gap-2"><Ic name="check" size="xs" className="t-success" />{step}</li>)}</ol> : null}
      {message.reasoningSummary ? <section aria-label="Ringkasan reasoning provider" className="stack gap-1"><strong>Ringkasan reasoning</strong><AiMarkdown content={message.reasoningSummary} compact /></section> : null}
      {!message.reasoningSummary && message.reasoningObserved ? <p className="t-muted">Model mengirim aktivitas reasoning. Ringkasan yang dapat ditampilkan belum tersedia.</p> : null}
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
