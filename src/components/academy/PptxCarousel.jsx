// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  EDITORIAL_PRESENTATION_MAX_BYTES,
  EDITORIAL_PRESENTATION_MAX_SLIDES,
} from "@/lib/editorialLimits";
import { normalisePptxForViewer } from "@/lib/pptxCompatibility";

const MAX_PPTX_BYTES = EDITORIAL_PRESENTATION_MAX_BYTES;
const MAX_PPTX_SLIDES = EDITORIAL_PRESENTATION_MAX_SLIDES;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normaliseDeclaredSlideCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getSameOriginPptxUrl(value) {
  if (typeof value !== "string" || !value.trim() || typeof window === "undefined") return null;

  try {
    const url = new URL(value.trim(), window.location.origin);
    if (url.origin !== window.location.origin || !/\.pptx$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function getFriendlyError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("too large") || message.includes("terlalu besar")) {
    return "Ukuran file presentasi melebihi batas 50 MB.";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("http")) {
    return "Presentasi belum dapat dimuat. Coba muat ulang halaman.";
  }
  return "Presentasi tidak dapat ditampilkan di browser ini.";
}

function getSlideContainers(viewer) {
  if (!viewer?.content) return [];
  const windowedSlides = Array.from(viewer.content.querySelectorAll(":scope > .flyfish-pptx-slide-slot"));
  if (windowedSlides.length) return windowedSlides;
  return Array.from(viewer.content.children).filter((element) => element.classList.contains("slide"));
}

function restorePresentationVisibility(viewer) {
  getSlideContainers(viewer).forEach((slide) => {
    slide.style.removeProperty("display");
    slide.removeAttribute("aria-hidden");
  });
}

/**
 * Renders a server-approved, same-origin PPTX as a responsive learner carousel.
 * The viewer is loaded only when an editorial block actually references a deck.
 */
export default function PptxCarousel({ src, title = "Presentasi", name = "", declaredSlideCount, compact = false }) {
  const targetRef = React.useRef(null);
  const viewerRef = React.useRef(null);
  const activeSlideRef = React.useRef(0);
  const renderCompleteRef = React.useRef(false);
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);
  const [status, setStatus] = React.useState("loading");
  const [error, setError] = React.useState("");
  const [slideErrors, setSlideErrors] = React.useState([]);
  const [loadProgress, setLoadProgress] = React.useState(0);
  const [reloadToken, setReloadToken] = React.useState(0);
  const expectedSlides = normaliseDeclaredSlideCount(declaredSlideCount);
  const source = React.useMemo(() => getSameOriginPptxUrl(src), [src]);

  const applyCarouselVisibility = React.useCallback((viewer, requestedIndex = activeSlideRef.current) => {
    const slides = getSlideContainers(viewer);
    const total = Number(viewer?.slideCount) || slides.length;
    if (!slides.length || slides.length !== total) return 0;
    if (total > MAX_PPTX_SLIDES) {
      setStatus("error");
      setError(`Presentasi maksimal ${MAX_PPTX_SLIDES} slide.`);
      return -1;
    }

    const nextIndex = clamp(requestedIndex, 0, total - 1);
    activeSlideRef.current = nextIndex;
    viewer.ensureSlideRendered?.(nextIndex + 1);
    viewer.ensureSlideRendered?.(nextIndex + 2);
    slides.forEach((slide, index) => {
      const isActive = index === nextIndex;
      slide.style.display = isActive
        ? (slide.classList.contains("flyfish-pptx-slide-slot") ? "flow-root" : "block")
        : "none";
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    setActiveSlide(nextIndex);
    setSlideCount(total);
    viewer.refreshLayout();
    return total;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let viewer = null;
    const controller = new AbortController();
    const target = targetRef.current;

    activeSlideRef.current = 0;
    renderCompleteRef.current = false;
    setActiveSlide(0);
    setSlideCount(0);
    setError("");
    setSlideErrors([]);
    setLoadProgress(0);
    setStatus("loading");

    if (!target || !source) {
      setStatus("error");
      setError("Tautan PPTX tidak valid.");
      return () => controller.abort();
    }

    const syncRenderedSlides = () => {
      if (cancelled || !viewer || !renderCompleteRef.current) return;
      const count = applyCarouselVisibility(viewer);
      if (count > 0) setStatus("ready");
    };

    const load = async () => {
      try {
        const response = await fetch(source, {
          signal: controller.signal,
          credentials: "same-origin",
          headers: { Accept: "application/vnd.openxmlformats-officedocument.presentationml.presentation, application/octet-stream" },
        });
        const resolvedResponseUrl = new URL(response.url || source, window.location.origin);
        if (resolvedResponseUrl.origin !== window.location.origin) {
          throw new Error("PPTX must stay on the academy origin.");
        }
        if (!response.ok) throw new Error(`PPTX request failed (${response.status}).`);

        const reportedSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(reportedSize) && reportedSize > MAX_PPTX_BYTES) {
          throw new Error("PPTX file is too large.");
        }

        const buffer = await response.arrayBuffer();
        if (!buffer.byteLength) throw new Error("PPTX file is empty.");
        if (buffer.byteLength > MAX_PPTX_BYTES) throw new Error("PPTX file is too large.");

        const viewerBuffer = await normalisePptxForViewer(buffer);
        const { PptxViewer } = await import("@file-viewer/pptx");
        if (cancelled) return;

        viewer = await PptxViewer.open(viewerBuffer, target, {
          fitMode: "contain",
          zoomPercent: 100,
          lazySlides: true,
          lazyMedia: true,
          listOptions: { windowed: true, initialSlides: 1, batchSize: 1, overscanViewport: 0.25 },
          zipLimits: { maxFileBytes: MAX_PPTX_BYTES },
          presentationFullscreen: true,
          onProgress: (progress) => {
            if (cancelled) return;
            const nextProgress = Number(progress);
            if (Number.isFinite(nextProgress)) setLoadProgress(clamp(nextProgress, 0, 100));
          },
          onSlideRendered: (_slideNumber, element) => {
            syncRenderedSlides();
            const message = element?.querySelector(".flyfish-pptx-slide-error-card span");
            if (message) {
              const slideNumber = element?.dataset?.slideIndex || "ini";
              message.textContent = `Slide ${slideNumber} belum dapat ditampilkan oleh browser.`;
            }
          },
          onRenderComplete: () => {
            if (cancelled) return;
            renderCompleteRef.current = true;
            const count = applyCarouselVisibility(viewer);
            if (!count) {
              setStatus("error");
              setError("File PPTX tidak memiliki slide yang dapat ditampilkan.");
            } else if (count > 0) {
              setStatus("ready");
            }
          },
          onPresentationChange: (presentation) => {
            if (cancelled || !viewer) return;
            const nextIndex = clamp(Number(presentation?.slideNumber || 1) - 1, 0, Math.max(viewer.slideCount - 1, 0));
            activeSlideRef.current = nextIndex;
            setActiveSlide(nextIndex);
            if (!presentation?.active) {
              requestAnimationFrame(() => {
                if (!cancelled) applyCarouselVisibility(viewer, nextIndex);
              });
            }
          },
          onSlideError: (slideNumber) => {
            if (cancelled) return;
            const number = Number(slideNumber) || 0;
            setSlideErrors((current) => current.includes(number) ? current : [...current, number]);
          },
          onError: (viewerError) => {
            if (cancelled) return;
            setStatus("error");
            setError(getFriendlyError(viewerError));
          },
        });
        if (cancelled) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;
      } catch (loadError) {
        if (cancelled || loadError?.name === "AbortError") return;
        setStatus("error");
        setError(getFriendlyError(loadError));
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
      if (viewerRef.current === viewer) viewerRef.current = null;
      viewer?.destroy();
    };
  }, [applyCarouselVisibility, reloadToken, source]);

  const selectSlide = React.useCallback((requestedIndex) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    applyCarouselVisibility(viewer, requestedIndex);
  }, [applyCarouselVisibility]);

  const enterPresentation = React.useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      restorePresentationVisibility(viewer);
      await viewer.enterPresentation(activeSlideRef.current + 1);
    } catch (presentationError) {
      applyCarouselVisibility(viewer);
      setError(getFriendlyError(presentationError));
    }
  }, [applyCarouselVisibility]);

  const handleKeyDown = React.useCallback((event) => {
    if (status !== "ready" || !slideCount) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectSlide(activeSlide - 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") {
      event.preventDefault();
      selectSlide(activeSlide + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectSlide(slideCount - 1);
    }
  }, [activeSlide, selectSlide, slideCount, status]);

  const controlsDisabled = status !== "ready" || slideCount < 2;
  const liveStatus = error
    ? error
    : status === "loading"
      ? expectedSlides ? `Memuat presentasi, ${expectedSlides} slide.` : "Memuat presentasi…"
      : `Slide ${activeSlide + 1} dari ${slideCount}.`;

  return (
    <section
      className={`${compact ? "mt-3" : "my-7"} aapm-presentation-shell overflow-hidden`}
      aria-label={title || "Presentasi"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-viewer="pptx"
    >
      <header className="aapm-presentation-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="aapm-presentation-file-icon bg-tint-orange text-brand-orange" aria-hidden="true">
            <AapmIcon name="fileCheck" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="aapm-presentation-eyebrow">Presentasi</p>
            <h3 className="truncate text-sm font-semibold sm:text-base">{title || "Presentasi"}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              PPTX <span aria-hidden="true">·</span> {slideCount ? `${slideCount} slide` : expectedSlides ? `${expectedSlides} slide` : "siap dibaca"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {source && <a href={source} download={name || undefined} className="aapm-presentation-icon-action" aria-label="Unduh presentasi">
            <AapmIcon name="download" className="h-4 w-4" />
          </a>}
          <button
            type="button"
            onClick={() => void enterPresentation()}
            disabled={status !== "ready" || !slideCount}
            className="aapm-presentation-action"
          >
            <AapmIcon name="solar:full-screen-bold" className="h-4 w-4" />
            <span className="hidden sm:inline">Layar penuh</span>
            <span className="sm:hidden">Buka</span>
          </button>
        </div>
      </header>

      <div className="aapm-presentation-stage" aria-busy={status === "loading"}>
        <div className="aapm-pptx-viewport">
          <div ref={targetRef} className="aapm-pptx-target h-full w-full min-w-0 overflow-hidden" />
        </div>
        {slideErrors.length > 0 && (
          <div className="aapm-presentation-notice" role="status">
            <AapmIcon name="alert" className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
            <span>Slide {slideErrors.join(", ")} belum dapat ditampilkan. Coba simpan ulang PPTX dari PowerPoint lalu unggah kembali.</span>
          </div>
        )}
        {status === "loading" && (
          <div className="aapm-presentation-state" role="status">
            <div className="aapm-presentation-state-card">
              <AapmIcon name="loading" className="h-5 w-5 animate-spin text-brand-green" />
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Menyiapkan presentasi…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{expectedSlides ? `${expectedSlides} slide sedang diproses` : "Memeriksa file dan memuat slide"}</p>
                <div className="aapm-presentation-progress" aria-hidden="true"><span style={{ width: `${loadProgress || 6}%` }} /></div>
              </div>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="aapm-presentation-state" role="alert">
            <div className="aapm-presentation-state-card max-w-sm flex-col items-center text-center">
              <span className="aapm-presentation-error-icon"><AapmIcon name="alert" className="h-5 w-5 text-brand-orange" /></span>
              <p className="mt-1 text-sm font-semibold text-foreground">Presentasi tidak dapat dimuat</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="aapm-presentation-action">Coba lagi</button>
                {source && <a href={source} download={name || undefined} className="aapm-presentation-action">Unduh file</a>}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="aapm-presentation-controls">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" aria-label="Slide sebelumnya" onClick={() => selectSlide(activeSlide - 1)} disabled={controlsDisabled || activeSlide === 0} className="aapm-presentation-icon-action">
            <AapmIcon name="arrowLeft" className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-foreground">
            {slideCount ? <><span>{activeSlide + 1}</span><span className="mx-1 text-muted-foreground">/</span><span className="text-muted-foreground">{slideCount}</span></> : "— / —"}
          </span>
          <button type="button" aria-label="Slide berikutnya" onClick={() => selectSlide(activeSlide + 1)} disabled={controlsDisabled || activeSlide >= slideCount - 1} className="aapm-presentation-icon-action">
            <AapmIcon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>

        {slideCount > 1 && (slideCount <= 12 ? (
          <div className="flex max-w-full flex-wrap justify-end gap-0.5" role="group" aria-label="Pilih slide presentasi">
            {Array.from({ length: slideCount }, (_, index) => {
              const isActive = index === activeSlide;
              return <button key={index} type="button" onClick={() => selectSlide(index)} aria-label={`Buka slide ${index + 1}`} aria-current={isActive ? "step" : undefined} className="aapm-presentation-dot-button"><span className={isActive ? "aapm-presentation-dot is-active" : "aapm-presentation-dot"} /></button>;
            })}
          </div>
        ) : (
          <label className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="shrink-0">Lompat</span>
            <input type="range" min="1" max={slideCount} value={activeSlide + 1} onChange={(event) => selectSlide(Number(event.target.value) - 1)} aria-label="Pilih nomor slide" className="h-8 min-w-0 flex-1 accent-brand-green" />
          </label>
        ))}
        <p className="sr-only" aria-live="polite">{liveStatus}</p>
      </footer>
    </section>
  );
}
