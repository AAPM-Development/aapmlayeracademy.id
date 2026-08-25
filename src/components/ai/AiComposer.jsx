import React, { useEffect, useRef } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, Switch } from "@/components/primitives";

/**
 * The single composer used by the full APPI workspace and the quick panel.
 * Keeping the input surface in one place prevents the mobile and desktop
 * versions from drifting apart as the assistant evolves.
 */
export default function AiComposer({
  input = "",
  setInput = () => {},
  onSubmit = () => {},
  isStreaming = false,
  imageInputRef,
  onImageSelection = () => {},
  imageAttachment = null,
  onRemoveImage = () => {},
  attachmentError = "",
  includeFarm = true,
  onIncludeFarmChange = () => {},
  allowWebSearch = false,
  onAllowWebSearchChange = () => {},
  contextLabel = "Academy",
  placeholder = "Tanyakan situasi yang sedang terjadi di farm…",
  compact = false,
  showFarmToggle = true,
  showPrivacy = false,
  idPrefix = "appi-composer",
}) {
  const textareaRef = useRef(null);
  const hasContent = Boolean(input.trim() || imageAttachment);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const maxHeight = compact ? 112 : 168;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [compact, input]);

  return (
    <div className={`min-w-0 w-full ${compact ? "text-xs" : "text-sm"}`}>
      <input
        ref={imageInputRef}
        id={idPrefix}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onImageSelection}
        className="sr-only"
      />

      <div className="min-w-0 overflow-hidden rounded-[1.15rem] border border-input bg-surface-elevated shadow-sm transition-[border-color,box-shadow] focus-within:border-brand-orange/70 focus-within:shadow-[0_8px_24px_hsl(var(--aapm-orange-700)/0.10)]">
        {imageAttachment && (
          <div className="flex min-w-0 items-center gap-2 border-b border-border/70 bg-surface-subtle/75 px-3 py-2">
            <img
              src={imageAttachment.dataUrl}
              alt="Pratinjau foto lampiran"
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
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

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!isStreaming) onSubmit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          aria-label="Pertanyaan untuk APPI"
          className={`block max-h-[10.5rem] min-h-[2.75rem] w-full resize-none overflow-y-auto bg-transparent px-3 py-3 leading-5 outline-none placeholder:text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
        />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 px-2 py-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef?.current?.click()}
              disabled={isStreaming}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-tint-orange hover:text-brand-orange"
              aria-label="Lampirkan foto farm"
              title="Lampirkan foto farm"
            >
              <AapmIcon name="solar:gallery-add-bold-duotone" className="h-4 w-4" />
            </Button>
            <span className="hidden max-w-[11rem] truncate text-[10px] text-muted-foreground sm:inline-flex">
              <AapmIcon name="solar:map-point-bold-duotone" className="mr-1 h-3.5 w-3.5 shrink-0 text-brand-orange" />
              {contextLabel}
            </span>
            {showFarmToggle && (
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Switch
                  checked={includeFarm}
                  onCheckedChange={onIncludeFarmChange}
                  aria-label="Sertakan data KPI sebagai konteks"
                  disabled={isStreaming}
                  className="scale-75"
                />
                Pakai KPI
              </label>
            )}
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <Switch
                checked={allowWebSearch}
                onCheckedChange={onAllowWebSearchChange}
                aria-label="Izinkan APPI mencari referensi web"
                disabled={isStreaming}
                className="scale-75"
              />
              <AapmIcon name="solar:global-bold-duotone" className="h-3.5 w-3.5 text-brand-orange" />
              Cari web
            </label>
          </div>

          <Button
            type="button"
            onClick={onSubmit}
            disabled={!hasContent || isStreaming}
            className="h-9 w-9 shrink-0 rounded-xl bg-brand-orange p-0 text-white shadow-sm hover:bg-brand-orange/90 disabled:bg-muted disabled:text-muted-foreground"
            aria-label={isStreaming ? "APPI sedang menyiapkan jawaban" : "Kirim pertanyaan"}
            title="Kirim pertanyaan"
          >
            <AapmIcon name="solar:plain-2-bold" className="h-[17px] w-[17px]" />
            <span className="sr-only">Kirim</span>
          </Button>
        </div>
      </div>

      {attachmentError && (
        <p className="mt-1.5 text-[10px] font-medium text-danger">{attachmentError}</p>
      )}
      {showPrivacy && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
            Untuk diagnosis penyakit atau dosis obat, konsultasikan dengan dokter hewan.
          </span>
          <span className="hidden sm:inline">Enter kirim · Shift+Enter baris baru</span>
        </div>
      )}
    </div>
  );
}
