import AiMarkdown from "./AiMarkdown";

/** Provider summaries are separate from final answer content and copy actions. */
export default function AiResponseDetails({ message, compact = false }) {
  if (message.role !== "assistant" || message.fallback) return null;
  const steps = message.processSteps || [];
  if (!message.model && !message.reasoningSummary && !message.reasoningObserved && !steps.length) return null;
  return (
    <details className="aapm-ai-details" data-density={compact ? "compact" : undefined}>
      <summary>
        <span>{message.streaming ? "Aktivitas respons" : "Detail respons"}</span>
        {message.model && <span className="aapm-ai-details__model" title={message.model}>{message.model}</span>}
      </summary>
      <div className="aapm-ai-details__body">
        {message.provider && <p className="aapm-ai-details__provider">Provider: {message.provider}</p>}
        {steps.length > 0 && <ol aria-label="Aktivitas permintaan">{steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>}
        {message.reasoningSummary && <section aria-label="Ringkasan reasoning provider"><strong>Ringkasan reasoning</strong><AiMarkdown content={message.reasoningSummary} compact /></section>}
        {!message.reasoningSummary && message.reasoningObserved && <p>Model mengirim aktivitas reasoning. Ringkasan yang dapat ditampilkan belum tersedia.</p>}
      </div>
    </details>
  );
}

