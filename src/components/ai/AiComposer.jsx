import React, { useCallback, useEffect, useRef } from "react";
import { Ic } from "@/design-system/canvas";
import { cn } from "@/lib/utils";

/**
 * The single composer used by the full APPI workspace and the quick panel
 * (canvas `.composer`): the question, then photo, KPI context and web search
 * toggles, and the round send button. Keeping the input surface in one place
 * prevents the mobile and desktop versions from drifting apart.
 */
export default function AiComposer({
  input = "",
  setInput = (_value) => {},
  onSubmit = () => {},
  onStop = null,
  isStreaming = false,
  disabled = false,
  imageInputRef,
  onImageSelection = () => {},
  imageLoading = false,
  imageAttachment = null,
  onRemoveImage = () => {},
  attachmentError = "",
  includeFarm = true,
  onIncludeFarmChange = (_value) => {},
  allowWebSearch = false,
  onAllowWebSearchChange = (_value) => {},
  contextLabel = "",
  farmAvailable = true,
  placeholder = "Tanya APPI tentang farm Anda…",
  compact = false,
  showFarmToggle = true,
  showPrivacy = false,
  idPrefix = "appi-composer",
}) {
  const textareaRef = useRef(null);
  const hasContent = Boolean(input.trim() || imageAttachment);
  const cannotSend = disabled || isStreaming || imageLoading;

  // After a tap on Kirim the focus would fall to the disabled button. Put it back
  // in the question so the next one can be typed straight away; phones skip this
  // so the keyboard does not reopen after every send.
  const handleSendClick = () => {
    if (hasContent && !cannotSend) onSubmit();
    if (window.matchMedia?.("(pointer: fine)").matches) textareaRef.current?.focus();
  };

  const resizeInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const maxHeight = compact ? 112 : 168;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [compact]);
  useEffect(resizeInput, [disabled, input, placeholder, resizeInput]);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === "undefined") return undefined;
    let previousWidth = 0;
    let resizeFrame = null;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === previousWidth) return;
      previousWidth = entry.contentRect.width;
      // Measure after responsive styles and placeholder wrapping have settled.
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        resizeInput();
      });
    });
    observer.observe(textarea);
    return () => {
      observer.disconnect();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    };
  }, [resizeInput]);

  const farmOn = farmAvailable && includeFarm;

  return (
    <div className={cn("aapm-ai-composer stack gap-2 w-full", compact && "composer-compact")} style={{ minWidth: 0 }}>
      <input
        ref={imageInputRef}
        id={idPrefix}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Pilih foto farm untuk dianalisis"
        onChange={onImageSelection}
        disabled={cannotSend}
        className="sr-only"
      />

      <div className="composer">
        {imageAttachment ? (
          <div className="row gap-2 composer-attachment">
            <img src={imageAttachment.dataUrl} alt="Pratinjau foto lampiran" />
            <span className="t-caption t-medium t-clamp-1 grow">{imageAttachment.name}</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" onClick={onRemoveImage} aria-label="Hapus foto lampiran"><Ic name="x-circle" size="sm" /></button>
          </div>
        ) : null}
        {imageLoading && !imageAttachment ? (
          <div className="row gap-2 t-caption t-ai composer-attachment" role="status" aria-live="polite">
            <span className="typing" aria-hidden="true"><i /><i /><i /></span>
            <span>Menyiapkan foto…</span>
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              if (hasContent && !cannotSend) onSubmit();
            }
          }}
          rows={compact ? 1 : 2}
          maxLength={3000}
          readOnly={disabled}
          placeholder={disabled ? "Memuat percakapan…" : placeholder}
          aria-label="Pesan untuk APPI"
        />

        <div className="composer-foot">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-quiet aapm-ai-attachment-control"
            onClick={() => imageInputRef?.current?.click()}
            disabled={cannotSend}
            aria-label="Lampirkan foto farm"
            aria-busy={imageLoading || undefined}
          >
            <Ic name="camera" />Foto
          </button>
          {contextLabel ? <span className="chip chip-ai hide-sm composer-context" title={contextLabel}><Ic name="pin" />{contextLabel}</span> : null}
          <span className="vr" style={{ margin: "6px 4px" }} aria-hidden="true" />
          {showFarmToggle ? (
            <label className="switch switch-ai" style={{ padding: "0 var(--s-2)" }} title={farmAvailable ? undefined : "Belum ada catatan KPI. Isi di Farm KPI agar APPI bisa membaca data farm."}>
              <input
                type="checkbox"
                role="switch"
                checked={farmOn}
                aria-checked={farmOn}
                aria-label="Sertakan data KPI sebagai konteks"
                disabled={cannotSend || !farmAvailable}
                onChange={(event) => onIncludeFarmChange(event.target.checked)}
              />
              {farmAvailable ? "Pakai KPI" : "KPI kosong"}
            </label>
          ) : null}
          <label className="switch" style={{ padding: "0 var(--s-2)" }}>
            <input
              type="checkbox"
              role="switch"
              checked={allowWebSearch}
              aria-checked={allowWebSearch}
              aria-label="Izinkan APPI mencari referensi web"
              disabled={cannotSend}
              onChange={(event) => onAllowWebSearchChange(event.target.checked)}
            />
            Cari web
          </label>
          <span className="grow" />
          {isStreaming && onStop ? (
            // While APPI writes, the round button stops the answer; the text so
            // far is kept and saved.
            <button type="button" className="send send-stop aapm-ai-send-control" onClick={onStop} aria-label="Hentikan jawaban APPI" title="Hentikan">
              <span className="send-stop-glyph" aria-hidden="true" />
            </button>
          ) : <button
            type="button"
            className="send aapm-ai-send-control"
            onClick={handleSendClick}
            disabled={!hasContent || cannotSend}
            aria-busy={isStreaming || undefined}
            aria-label={isStreaming ? "APPI sedang menyiapkan jawaban" : "Kirim"}
            title="Kirim"
          >
            {isStreaming ? <span className="typing typing-light" aria-hidden="true"><i /><i /><i /></span> : <Ic name="send" />}
          </button>}
        </div>
      </div>

      {attachmentError ? <p className="t-caption t-danger t-medium">{attachmentError}</p> : null}
      {showPrivacy ? (
        <div className="row between wrap gap-2" style={{ padding: "0 var(--s-2)" }}>
          <span className="row gap-1-5 t-caption t-muted">
            <Ic name="info" size="xs" />
            {/* Phones keep the safety line to one row so the transcript keeps its height. */}
            <span className="hide-sm">Untuk diagnosis penyakit atau dosis obat, konsultasikan dengan dokter hewan.</span>
            <span className="show-sm">Penyakit atau dosis obat? Tanyakan dokter hewan.</span>
          </span>
          <span className="row gap-1 t-caption t-muted hide-sm"><span className="kbd">Enter</span>kirim ·<span className="kbd">Shift</span>+<span className="kbd">Enter</span>baris baru</span>
        </div>
      ) : null}
    </div>
  );
}
