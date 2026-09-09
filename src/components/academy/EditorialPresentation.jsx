// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import PptxCarousel from "@/components/academy/PptxCarousel";
import {
  editorialPresentationMeta,
  getEditorialPresentationFormat,
  getEditorialPresentationFormatFromUrl,
} from "@/lib/editorialPresentation";
import { safeInternalPath } from "@/lib/editorialUrls";
import { cn } from "@/lib/utils";

function safePresentationUrl(value, format) {
  const safe = safeInternalPath(value);
  if (!safe || !/^\/uploads\/editorial\/presentations\/[0-9]{4}\/[0-9]{2}\/[a-f0-9]{40}\.[a-z0-9]+$/i.test(safe.split(/[?#]/, 1)[0])) {
    return null;
  }
  const actualFormat = getEditorialPresentationFormatFromUrl(safe);
  return actualFormat === format ? safe : null;
}

export default function EditorialPresentation({
  src,
  format,
  title = "Presentasi",
  name = "",
  declaredSlideCount,
  compact = false,
}) {
  const resolvedFormat = getEditorialPresentationFormat(format) || getEditorialPresentationFormatFromUrl(src);
  const safeSrc = safePresentationUrl(src, resolvedFormat);
  if (!safeSrc || !resolvedFormat) return null;

  const meta = editorialPresentationMeta(resolvedFormat);
  if (meta.viewer === "slides") {
    return (
      <PptxCarousel
        src={safeSrc}
        title={title || name || meta.label}
        declaredSlideCount={declaredSlideCount}
        compact={compact}
      />
    );
  }

  if (meta.viewer === "pdf") {
    return (
      <section className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-sm", compact ? "mt-3" : "my-7")} aria-label={title || name || meta.label}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange"><AapmIcon name="fileCheck" className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold sm:text-base">{title || name || meta.label}</h3>
              <p className="text-xs text-muted-foreground">{name || meta.label}</p>
            </div>
          </div>
          <a href={safeSrc} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition-colors hover:border-brand-green/40 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
            <AapmIcon name="arrowRight" className="h-4 w-4" />
            Buka PDF
          </a>
        </div>
        <div className="bg-muted/40 p-2 sm:p-4">
          <iframe src={safeSrc} title={title || name || "PDF materi"} loading="lazy" className="h-[min(70vh,48rem)] min-h-[24rem] w-full rounded-xl border border-border bg-white" />
        </div>
      </section>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-sm", compact ? "mt-3" : "my-7")} aria-label={title || name || meta.label}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-orange text-brand-orange"><AapmIcon name="fileCheck" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold sm:text-base">{title || name || meta.label}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{name || meta.label} diterima. Browser tidak merender format legacy ini langsung; buka file untuk melihatnya di aplikasi yang sesuai.</p>
          </div>
        </div>
        <a href={safeSrc} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-brand-green/40 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
          <AapmIcon name="arrowRight" className="h-4 w-4" />
          Buka {meta.shortLabel}
        </a>
      </div>
    </section>
  );
}
