// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import PptxCarousel from "@/components/academy/PptxCarousel";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  editorialPresentationMeta,
  getEditorialPresentationFormat,
  getEditorialPresentationFormatFromUrl,
} from "@/lib/editorialPresentation";
import { safeInternalPath } from "@/lib/editorialUrls";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function safePresentationUrl(value, format) {
  const safe = safeInternalPath(value);
  if (!safe || !/^\/uploads\/editorial\/presentations\/[0-9]{4}\/[0-9]{2}\/[a-f0-9]{40}\.[a-z0-9]+$/i.test(safe.split(/[?#]/, 1)[0])) {
    return null;
  }
  const actualFormat = getEditorialPresentationFormatFromUrl(safe);
  return actualFormat === format ? safe : null;
}

function PdfViewer({ src, title, name, meta, compact }) {
  const [status, setStatus] = React.useState("loading");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [fitWidth, setFitWidth] = React.useState(true);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const canvasRef = React.useRef(null);
  const viewportRef = React.useRef(null);
  const pdfRef = React.useRef(null);
  const renderTaskRef = React.useRef(null);
  const loadTimeoutRef = React.useRef(null);
  const label = title || name || meta.label;

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setFitWidth(true);
    pdfRef.current = null;
    window.clearTimeout(loadTimeoutRef.current);

    const load = async () => {
      try {
        // Keep the reader independent from Chrome's PDF plug-in. This also
        // works on the installed PWA and on cPanel hosts that send a download
        // disposition instead of an inline browser disposition.
        const loadingTask = pdfjs.getDocument({
          url: src,
          withCredentials: true,
          disableRange: true,
          disableStream: true,
        });
        loadTimeoutRef.current = window.setTimeout(() => {
          if (!cancelled) {
            loadingTask.destroy();
            setStatus("error");
            setErrorMessage("PDF terlalu lama dimuat. Buka tab baru atau unduh file untuk membacanya.");
          }
        }, compact ? 15000 : 20000);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        window.clearTimeout(loadTimeoutRef.current);
        pdfRef.current = pdf;
        setPageCount(pdf.numPages || 0);
        setStatus("rendering");
      } catch (error) {
        if (cancelled) return;
        window.clearTimeout(loadTimeoutRef.current);
        setStatus("error");
        setErrorMessage(error?.message || "PDF belum dapat dibaca di halaman ini.");
      }
    };

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeoutRef.current);
      renderTaskRef.current?.cancel?.();
      renderTaskRef.current = null;
      const pdf = pdfRef.current;
      pdfRef.current = null;
      pdf?.destroy?.();
    };
  }, [src, compact]);

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry?.contentRect?.width || 0);
      if (nextWidth > 0) setViewportWidth(nextWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas || !pageCount) return;
      renderTaskRef.current?.cancel?.();
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, (viewportWidth || viewportRef.current?.clientWidth || 720) - 32);
        const scale = fitWidth
          ? Math.min(Math.max(availableWidth / baseViewport.width, 0.5), 2.4)
          : Math.min(Math.max(zoom, 0.5), 2.6);
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas PDF tidak tersedia di browser ini.");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        renderTaskRef.current = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
        });
        await renderTaskRef.current.promise;
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (cancelled || error?.name === "RenderingCancelledException") return;
        setStatus("error");
        setErrorMessage(error?.message || "Halaman PDF belum dapat dirender.");
      }
    };
    render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [pageNumber, pageCount, fitWidth, zoom, viewportWidth]);

  const loaded = status === "ready";
  const failed = status === "error";
  const previousPage = () => setPageNumber((current) => Math.max(1, current - 1));
  const nextPage = () => setPageNumber((current) => Math.min(pageCount || 1, current + 1));

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
        <div className="aapm-pdf-viewport" ref={viewportRef}>
          <div className="aapm-pdf-canvas-scroller">
            <canvas ref={canvasRef} className="aapm-pdf-canvas" aria-label={`${label}, halaman ${pageNumber}`} />
          </div>
        </div>
        {!loaded && !failed && (
          <div className="aapm-presentation-state" role="status">
            <div className="aapm-presentation-state-card">
              <AapmIcon name="loading" className="h-5 w-5 animate-spin text-brand-green" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Menyiapkan PDF…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Halaman {pageNumber} sedang dirender.</p>
              </div>
            </div>
          </div>
        )}
        {failed && (
          <div className="aapm-presentation-state" role="alert">
            <div className="aapm-presentation-state-card max-w-sm flex-col items-center text-center">
              <span className="aapm-presentation-error-icon"><AapmIcon name="alert" className="h-5 w-5 text-brand-orange" /></span>
              <p className="mt-1 text-sm font-semibold text-foreground">PDF belum dapat ditampilkan</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{errorMessage || "Buka file di tab baru atau unduh untuk membacanya di aplikasi PDF."}</p>
              <a href={src} target="_blank" rel="noopener noreferrer" className="aapm-presentation-action mt-3">Buka PDF</a>
            </div>
          </div>
        )}
      </div>

      {loaded && <div className="aapm-pdf-reader-controls" aria-label="Kontrol pembaca PDF">
        <div className="flex items-center gap-1.5">
          <button type="button" className="aapm-pdf-reader-button" onClick={previousPage} disabled={pageNumber <= 1} aria-label="Halaman sebelumnya" title="Halaman sebelumnya"><AapmIcon name="chevronLeft" className="h-4 w-4" /></button>
          <span className="aapm-pdf-page-count">Halaman {pageNumber} / {pageCount || "—"}</span>
          <button type="button" className="aapm-pdf-reader-button" onClick={nextPage} disabled={!pageCount || pageNumber >= pageCount} aria-label="Halaman berikutnya" title="Halaman berikutnya"><AapmIcon name="chevronRight" className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="aapm-pdf-reader-button" onClick={() => { setFitWidth(false); setZoom((current) => Math.max(0.5, Number((current - 0.1).toFixed(2)))); }} aria-label="Perkecil PDF" title="Perkecil"><AapmIcon name="minus" className="h-4 w-4" /></button>
          <button type="button" className={cn("aapm-pdf-page-count min-w-16", fitWidth && "text-brand-green")} onClick={() => setFitWidth(true)} title="Pas lebar halaman">{fitWidth ? "Pas layar" : `${Math.round(zoom * 100)}%`}</button>
          <button type="button" className="aapm-pdf-reader-button" onClick={() => { setFitWidth(false); setZoom((current) => Math.min(2.6, Number((current + 0.1).toFixed(2)))); }} aria-label="Perbesar PDF" title="Perbesar"><AapmIcon name="add" className="h-4 w-4" /></button>
        </div>
      </div>}

      <footer className="aapm-presentation-controls">
        <p className="m-0 text-xs text-muted-foreground">{loaded ? `PDF siap dibaca · ${pageCount || 0} halaman` : "Dokumen PDF"}</p>
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
