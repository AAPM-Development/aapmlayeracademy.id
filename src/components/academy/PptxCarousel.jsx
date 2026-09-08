// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

const MAX_PPTX_BYTES = 50 * 1024 * 1024;
const MAX_PPTX_SLIDES = 50;

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
export default function PptxCarousel({ src, title = "Presentasi", declaredSlideCount, compact = false }) {
  const targetRef = React.useRef(null);
  const viewerRef = React.useRef(null);
  const activeSlideRef = React.useRef(0);
  const renderCompleteRef = React.useRef(false);
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);
  const [status, setStatus] = React.useState("loading");
  const [error, setError] = React.useState("");
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

        const { PptxViewer } = await import("@file-viewer/pptx");
        if (cancelled) return;

        viewer = await PptxViewer.open(buffer, target, {
          fitMode: "contain",
          zoomPercent: 100,
          lazySlides: true,
          lazyMedia: true,
          listOptions: { windowed: true, initialSlides: 1, batchSize: 1, overscanViewport: 0.25 },
          zipLimits: { maxFileBytes: MAX_PPTX_BYTES },
          presentationFullscreen: true,
          onSlideRendered: () => syncRenderedSlides(),
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
  }, [applyCarouselVisibility, source]);

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

  const controlsDisabled = status !== "ready" || slideCount < 2;
  const liveStatus = error
    ? error
    : status === "loading"
      ? expectedSlides ? `Memuat presentasi, ${expectedSlides} slide.` : "Memuat presentasi…"
      : `Slide ${activeSlide + 1} dari ${slideCount}.`;

  return (
    <section className={`${compact ? "mt-3" : "my-7"} overflow-hidden rounded-2xl border border-border bg-surface shadow-sm`} aria-label={title || "Presentasi"}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold sm:text-base">{title || "Presentasi"}</h3>
        </div>
        <button
          type="button"
          onClick={() => void enterPresentation()}
          disabled={status !== "ready" || !slideCount}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition-colors hover:border-brand-green/40 hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        >
          <AapmIcon name="solar:full-screen-bold" className="h-4 w-4" />
          Layar penuh
        </button>
      </div>

      <div className="relative min-w-0 bg-muted/40 p-2 sm:p-4" aria-busy={status === "loading"}>
        <div ref={targetRef} className="min-h-[13rem] w-full min-w-0 overflow-hidden rounded-xl bg-white" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 px-5 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 shadow-sm">
              <AapmIcon name="loading" className="h-4 w-4 animate-spin text-brand-green" />
              Memuat presentasi…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-5 text-center">
            <div className="max-w-sm">
              <AapmIcon name="alert" className="mx-auto h-6 w-6 text-brand-orange" />
              <p className="mt-2 text-sm font-semibold">Presentasi tidak dapat dimuat</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Slide sebelumnya"
              onClick={() => selectSlide(activeSlide - 1)}
              disabled={controlsDisabled || activeSlide === 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-brand-green/40 hover:bg-tint-green disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              <AapmIcon name="arrowLeft" className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center text-xs font-semibold tabular-nums text-muted-foreground">
              {slideCount ? `Slide ${activeSlide + 1} / ${slideCount}` : "Memuat…"}
            </span>
            <button
              type="button"
              aria-label="Slide berikutnya"
              onClick={() => selectSlide(activeSlide + 1)}
              disabled={controlsDisabled || activeSlide >= slideCount - 1}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-brand-green/40 hover:bg-tint-green disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              <AapmIcon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>

          {slideCount > 1 && (slideCount <= 12 ? (
            <div className="flex max-w-full flex-wrap justify-end gap-1" role="group" aria-label="Pilih slide presentasi">
              {Array.from({ length: slideCount }, (_, index) => {
                const isActive = index === activeSlide;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectSlide(index)}
                    aria-label={`Buka slide ${index + 1}`}
                    aria-current={isActive ? "step" : undefined}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-brand-green" : "bg-border"}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex min-w-[min(100%,17rem)] flex-1 items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="shrink-0">Lompat ke slide</span>
              <input
                type="range"
                min="1"
                max={slideCount}
                value={activeSlide + 1}
                onChange={(event) => selectSlide(Number(event.target.value) - 1)}
                aria-label="Pilih nomor slide"
                className="h-11 min-w-0 flex-1 accent-brand-green"
              />
            </label>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{liveStatus}</p>
      </div>
    </section>
  );
}
