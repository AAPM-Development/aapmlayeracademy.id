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

function PdfViewer({ src, title, name, meta, compact }) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const label = title || name || meta.label;

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <section
      className={cn(`${compact ? "mt-3" : "my-7"} aapm-presentation-shell overflow-hidden`)}
      aria-label={label}
      data-viewer="pdf"
    >
      <header className="aapm-presentation-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="aapm-presentation-file-icon bg-tint-orange text-brand-orange" aria-hidden="true">
            <AapmIcon name="fileCheck" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="aapm-presentation-eyebrow">Dokumen</p>
            <h3 className="truncate text-sm font-semibold sm:text-base">{label}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">PDF <span aria-hidden="true">·</span> baca di halaman ini</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a href={src} download={name || undefined} className="aapm-presentation-icon-action" aria-label="Unduh PDF">
            <AapmIcon name="download" className="h-4 w-4" />
          </a>
          <a href={src} target="_blank" rel="noopener noreferrer" className="aapm-presentation-action">
            <AapmIcon name="arrowRight" className="h-4 w-4" />
            <span className="hidden sm:inline">Buka tab baru</span>
            <span className="sm:hidden">Buka</span>
          </a>
        </div>
      </header>

      <div className="aapm-presentation-stage" aria-busy={!loaded && !failed}>
        <div className="aapm-pdf-viewport">
          {!failed && <iframe
            key={src}
            src={src}
            title={label}
            loading={compact ? "eager" : "lazy"}
            className="aapm-pdf-frame"
            referrerPolicy="same-origin"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />}
        </div>
        {!loaded && !failed && (
          <div className="aapm-presentation-state" role="status">
            <div className="aapm-presentation-state-card">
              <AapmIcon name="loading" className="h-5 w-5 animate-spin text-brand-green" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Menyiapkan PDF…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Pembaca dokumen sedang dibuka.</p>
              </div>
            </div>
          </div>
        )}
        {failed && (
          <div className="aapm-presentation-state" role="alert">
            <div className="aapm-presentation-state-card max-w-sm flex-col items-center text-center">
              <span className="aapm-presentation-error-icon"><AapmIcon name="alert" className="h-5 w-5 text-brand-orange" /></span>
              <p className="mt-1 text-sm font-semibold text-foreground">PDF belum dapat ditampilkan</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Buka file di tab baru atau unduh untuk membacanya di aplikasi PDF.</p>
              <a href={src} target="_blank" rel="noopener noreferrer" className="aapm-presentation-action mt-3">Buka PDF</a>
            </div>
          </div>
        )}
      </div>

      <footer className="aapm-presentation-controls">
        <p className="m-0 text-xs text-muted-foreground">{loaded ? "PDF siap dibaca" : "Dokumen PDF"}</p>
        <span className="text-[11px] text-muted-foreground">Gunakan tombol di atas untuk membuka atau mengunduh.</span>
      </footer>
    </section>
  );
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
  const displayTitle = (title && title !== "Presentasi" ? title : name) || "Presentasi";
  if (meta.viewer === "slides") {
    return (
      <PptxCarousel
        src={safeSrc}
        title={displayTitle || meta.label}
        name={name}
        declaredSlideCount={declaredSlideCount}
        compact={compact}
      />
    );
  }

  if (meta.viewer === "pdf") {
    return <PdfViewer src={safeSrc} title={displayTitle} name={name} meta={meta} compact={compact} />;
  }

  return (
    <section className={cn(`${compact ? "mt-3" : "my-7"} aapm-presentation-shell overflow-hidden`)} aria-label={displayTitle || meta.label}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-orange text-brand-orange"><AapmIcon name="fileCheck" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold sm:text-base">{displayTitle || meta.label}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{name || meta.label} diterima. Browser tidak merender format legacy ini langsung; buka file untuk melihatnya di aplikasi yang sesuai.</p>
          </div>
        </div>
        <a href={safeSrc} target="_blank" rel="noopener noreferrer" className="aapm-presentation-action shrink-0">
          <AapmIcon name="arrowRight" className="h-4 w-4" />
          Buka {meta.shortLabel}
        </a>
      </div>
    </section>
  );
}
