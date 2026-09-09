import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

function providerLabel(message) {
  if (!message?.provider || message.fallback) return "";
  const provider =
    message.provider === "openrouter" ? "OpenRouter" : message.provider;
  return `${provider}${message.model ? ` · ${message.model}` : ""}`;
}

/**
 * Keep delivery and persistence details in one quiet line below an answer.
 * The data still drives the retry actions, but the transcript does not repeat
 * a full alert, a persistence line, and provider metadata for every message.
 */
export default function AiMessageMeta({
  message,
  retryPrompt = "",
  onRetry,
  onRetryPersistence,
  persistenceRetrying = false,
  disabled = false,
  compact = false,
  showMeta = true,
}) {
  const content = message?.content || "";
  const hasContent = Boolean(content);

  if (message?.streaming) return null;

  if (message?.error) {
    return (
      <div
        className={`aapm-ai-status-line aapm-ai-status-line--error ${compact ? "aapm-ai-status-line--compact" : ""}`}
        role="alert"
      >
        <AapmIcon name="alert" className="h-3.5 w-3.5 shrink-0" />
        <span>Permintaan tidak dapat diproses. Coba kirim ulang beberapa saat lagi.</span>
      </div>
    );
  }

  // The workspace header already establishes APPI and the latest answer owns
  // the recovery affordances. Keep older, successfully saved answers quiet;
  // unsaved answers remain visible so their retry path is never lost.
  if (!showMeta && message?.persisted) return null;

  const canRetryProvider = Boolean(message?.fallback && retryPrompt && onRetry);
  const canRetryPersistence = Boolean(
    !message?.persisted &&
      hasContent &&
      onRetryPersistence,
  );

  if (!message?.fallback && !message?.persisted && !canRetryPersistence && !message?.provider) {
    return null;
  }

  const warning = Boolean(message?.fallback || !message?.persisted);
  const provider = providerLabel(message);
  const label = message?.fallback
    ? message.persisted
      ? "Respons lokal · tersimpan"
      : "Respons lokal · belum tersimpan"
    : message.persisted
      ? "Tersimpan"
      : "Belum tersimpan";

  return (
    <div
      className={`aapm-ai-status-line ${warning ? "aapm-ai-status-line--warning" : "aapm-ai-status-line--success"} ${compact ? "aapm-ai-status-line--compact" : ""}`}
      title={message.notice || undefined}
      role="status"
    >
      <AapmIcon
        name={warning ? (message.fallback ? "solar:info-circle-bold" : "solar:refresh-circle-bold-duotone") : "solar:check-circle-bold-duotone"}
        className={`h-3.5 w-3.5 shrink-0 ${warning ? "text-brand-orange" : "text-brand-green"}`}
      />
      <span className="min-w-0 truncate">{label}</span>
      {provider && <span className="min-w-0 truncate text-muted-foreground/80">· {provider}</span>}
      <span className="sr-only">{message.notice || ""}</span>
      {canRetryProvider && (
        <button
          type="button"
          onClick={() => onRetry(retryPrompt)}
          className="aapm-ai-status-line__action"
        >
          Coba provider lagi
        </button>
      )}
      {canRetryPersistence && (
        <button
          type="button"
          onClick={() => onRetryPersistence(message)}
          disabled={persistenceRetrying || disabled}
          className="aapm-ai-status-line__action disabled:opacity-60"
        >
          {persistenceRetrying ? "Menyimpan…" : "Coba simpan lagi"}
        </button>
      )}
    </div>
  );
}
