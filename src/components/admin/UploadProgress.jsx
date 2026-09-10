// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button } from "@/components/primitives";
import { cn } from "@/lib/utils";

/**
 * Small, shared upload feedback used by editorial image and presentation
 * fields. The track is intentionally token-only so it remains legible in
 * both light/dark shells without introducing another visual language.
 */
export default function UploadProgress({ progress = null, label = "Mengunggah…", onCancel, className }) {
  const numericProgress = Number.isFinite(Number(progress))
    ? Math.min(100, Math.max(0, Math.round(Number(progress))))
    : null;

  return (
    <div className={cn("w-full rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2.5", className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[11px]">
        <AapmIcon name="loading" className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-green" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 tabular-nums font-semibold text-foreground" aria-label={numericProgress == null ? "Progres sedang dihitung" : `${numericProgress}% selesai`}>
          {numericProgress == null ? "…" : `${numericProgress}%`}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={numericProgress == null ? undefined : numericProgress}
      >
        <span
          className={cn("block h-full rounded-full bg-brand-green transition-[width] duration-200", numericProgress == null && "w-1/3 animate-pulse")}
          style={numericProgress == null ? undefined : { width: `${numericProgress}%` }}
        />
      </div>
      {onCancel && (
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={onCancel}>
            <AapmIcon name="close" className="h-3 w-3" />
            Batalkan
          </Button>
        </div>
      )}
    </div>
  );
}
