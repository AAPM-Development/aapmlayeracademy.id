import React, { useCallback, useEffect, useRef } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, Surface, Switch } from "@/components/primitives";

const ComposerSurface = /** @type {any} */ (Surface);

/**
 * The single composer used by the full APPI workspace and the quick panel.
 * Keeping the input surface in one place prevents the mobile and desktop
 * versions from drifting apart as the assistant evolves.
 */
export default function AiComposer({
  input = "",
  setInput = (_value) => {},
  onSubmit = () => {},
  isStreaming = false,
  disabled = false,
  imageInputRef,
  onImageSelection = () => {},
  imageLoading = false,
  imageAttachment = null,
  onRemoveImage = () => {},
  attachmentError = "",
  includeFarm = true,
  onIncludeFarmChange = () => {},
  allowWebSearch = false,
  onAllowWebSearchChange = () => {},
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

  return (
    <div className={`aapm-ai-composer min-w-0 w-full ${compact ? "aapm-ai-composer--compact text-xs" : "text-sm"}`}>
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

      <ComposerSurface
        as="div"
        className="aapm-ai-composer-frame min-w-0 overflow-hidden transition-[border-color,box-shadow]"
      >
        {imageAttachment && (
          <div className="flex min-w-0 items-center gap-2 border-b border-border/70 bg-surface-subtle/75 px-3 py-2">
            <img
              src={imageAttachment.dataUrl}
              alt="Pratinjau foto lampiran"
              className="h-9 w-9 shrink-0 rounded-[var(--radius-control)] object-cover ring-1 ring-border"
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {imageAttachment.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemoveImage}
              className="h-7 w-7 shrink-0"
              aria-label="Hapus foto lampiran"
            >
              <AapmIcon name="solar:close-circle-bold" className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {imageLoading && !imageAttachment && (
          <div className="flex items-center gap-2 border-b border-border/70 bg-tint-orange/45 px-3 py-2 text-[11px] text-tint-orange-foreground" role="status" aria-live="polite">
            <AapmIcon name="loading" className="h-3.5 w-3.5 animate-spin" />
            <span>Menyiapkan foto…</span>
          </div>
        )}

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
          rows={1}
          maxLength={3000}
          readOnly={disabled}
          placeholder={disabled ? "Memuat percakapan…" : placeholder}
          aria-label="Pertanyaan untuk APPI"
          className={`block max-h-[10.5rem] min-h-[2.75rem] w-full resize-none overflow-y-auto bg-transparent px-3 py-3 leading-5 outline-none placeholder:text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
        />

        <div className="aapm-ai-composer-frame__footer flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 px-2 py-1.5">
          <div className="aapm-ai-composer-tools flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => imageInputRef?.current?.click()}
              disabled={cannotSend}
              className="aapm-ai-attachment-control h-10 shrink-0 gap-1.5 px-2 text-muted-foreground hover:bg-tint-orange hover:text-brand-orange sm:h-8"
              aria-label="Lampirkan foto farm"
              aria-busy={imageLoading}
              title="Lampirkan foto farm"
            >
              <AapmIcon name="solar:gallery-add-bold-duotone" className="h-4 w-4" />
              <span className="text-xs font-semibold">Foto</span>
            </Button>
            {contextLabel && (
              <span className="aapm-ai-composer-context hidden max-w-[11rem] min-w-0 truncate text-[11px] text-muted-foreground sm:inline-flex">
                <AapmIcon name="solar:map-point-bold-duotone" className="mr-1 h-3.5 w-3.5 shrink-0 text-brand-orange" />
                <span className="truncate">{contextLabel}</span>
              </span>
            )}
            {showFarmToggle && (
              <label
                className="aapm-ai-composer-toggle inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground data-[unavailable=true]:cursor-default"
                data-unavailable={farmAvailable ? undefined : "true"}
                title={farmAvailable ? undefined : "Belum ada catatan KPI. Isi di Farm KPI agar APPI bisa membaca data farm."}
              >
                <Switch
                  checked={farmAvailable && includeFarm}
                  onCheckedChange={onIncludeFarmChange}
                  aria-label="Sertakan data KPI sebagai konteks"
                  disabled={cannotSend || !farmAvailable}
                  className="aapm-ai-composer-switch"
                />
                {farmAvailable ? "Pakai KPI" : "KPI kosong"}
              </label>
            )}
            <label className="aapm-ai-composer-toggle inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Switch
                checked={allowWebSearch}
                onCheckedChange={onAllowWebSearchChange}
                aria-label="Izinkan APPI mencari referensi web"
                disabled={cannotSend}
                className="aapm-ai-composer-switch"
              />
              <AapmIcon name="solar:global-bold-duotone" className="h-3.5 w-3.5 text-brand-orange" />
              Cari web
            </label>
          </div>

          <Button
            type="button"
            onClick={handleSendClick}
            disabled={!hasContent || cannotSend}
            className="aapm-ai-send-control h-9 min-w-[4.75rem] shrink-0 gap-1.5 bg-brand-orange px-3 text-white hover:bg-brand-orange/90 disabled:bg-muted disabled:text-muted-foreground"
            aria-label={isStreaming ? "APPI sedang menyiapkan jawaban" : "Kirim pertanyaan"}
            title="Kirim pertanyaan"
          >
            <AapmIcon name={isStreaming ? "loading" : "solar:plain-2-bold"} className={`h-[17px] w-[17px] ${isStreaming ? "animate-spin" : ""}`} />
            <span className="text-xs font-semibold">{isStreaming ? "Menjawab…" : "Kirim"}</span>
          </Button>
        </div>
      </ComposerSurface>

      {attachmentError && (
        <p className="mt-1.5 text-[11px] font-medium text-danger">{attachmentError}</p>
      )}
      {showPrivacy && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
            {/* Phones keep the safety line to one row so the transcript keeps its height. */}
            <span className="hidden sm:inline">Untuk diagnosis penyakit atau dosis obat, konsultasikan dengan dokter hewan.</span>
            <span className="sm:hidden">Penyakit atau dosis obat? Tanyakan dokter hewan.</span>
          </span>
          <span className="hidden sm:inline">Enter kirim · Shift+Enter baris baru</span>
        </div>
      )}
    </div>
  );
}
