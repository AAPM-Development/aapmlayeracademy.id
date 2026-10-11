import React from "react";
import { Alert } from "@/design-system";
import { Ic } from "@/design-system/canvas";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import LessonVideoPlayer from "./LessonVideoPlayer";
import { trustedVideoSource } from "@/lib/lessonVideoSource";
export { trustedVideoSource } from "@/lib/lessonVideoSource";

// Lesson anatomy of the Redesign v2 canvas (focus shell, reading column of
// 760 px): lesson-sect heads with a hue tile, callouts and the TOC rail.

export const lessonSections = [
  { id: "content", label: "Materi", icon: "lesson" },
  { id: "video", label: "Video materi", icon: "video" },
  { id: "objectives", label: "Tujuan & insight", icon: "target" },
  { id: "practical", label: "Praktik di kandang", icon: "practice" },
];

export function LessonMedia({ module = null } = {}) {
  const [loadedEmbedSource, setLoadedEmbedSource] = React.useState("");
  const mediaUrl =
    typeof module?.videoUrl === "string" && module.videoUrl.trim()
      ? module.videoUrl
      : typeof module?.videoEmbedUrl === "string" && module.videoEmbedUrl.trim()
        ? module.videoEmbedUrl
        : typeof module?.video === "string" && module.video.trim()
          ? module.video
          : null;
  const source = trustedVideoSource(mediaUrl);

  React.useEffect(() => {
    setLoadedEmbedSource("");
  }, [source?.src]);

  if (!module) return null;

  if (source) {
    // An embed can be blocked (network, extensions, region); the original link
    // is always one tap away instead of a dead grey frame.
    const provider = source.provider || (/vimeo/.test(source.src) ? "Vimeo" : "YouTube");
    const youtubeId = source.kind === "embed" && provider === "YouTube"
      ? new URL(source.src).pathname.split("/").pop()
      : null;
    if (source.kind === "link") {
      return <Alert tone="info" icon="video" title="Video Dailymotion" description={<a href={source.src} target="_blank" rel="noopener noreferrer" className="btn-link">Buka di Dailymotion<Ic name="external" size="xs" /><span className="sr-only"> (tab baru)</span></a>} />;
    }
    if (source.kind === "file" || youtubeId) {
      return <LessonVideoPlayer key={source.src} src={source.src} videoId={youtubeId} title={`Video ${module.title || "materi"}`} fallbackUrl={mediaUrl} />;
    }
    return (
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="aapm-lesson-media">
          {loadedEmbedSource !== source.src && <div className="aapm-lesson-media__loading" aria-live="polite"><span className="typing" aria-hidden="true"><i /><i /><i /></span>Memuat video…</div>}
          <iframe
            className="absolute inset-0 h-full w-full"
            src={source.src}
            title={`Video ${module.title || ""}`.trim()}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setLoadedEmbedSource(source.src)}
          />
        </div>
        {source.kind === "embed" ? (
          <p className="t-caption t-muted" style={{ padding: "10px 14px 12px" }}>
            Video tidak muncul?{" "}
            <a className="btn-link" href={mediaUrl} target="_blank" rel="noopener noreferrer">
              Buka di {provider}<Ic name="external" size="xs" /><span className="sr-only"> (tab baru)</span>
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (mediaUrl) {
    return (
      <Alert
        tone="warning"
        icon="shieldWarning"
        title="Tautan video tidak dapat ditampilkan"
        description="Gunakan YouTube, Vimeo, Google Drive, Loom, URL embed Dailymotion dengan Player ID, atau file video HTTPS/internal (MP4, WebM, OGG, M4V)."
      />
    );
  }

  return null;
}

/** Lesson title block: level chip, module and time chips, title and summary. */
export function LessonHeader({ module = null, completed = false, hue = "green", minutes = null } = {}) {
  if (!module) return null;
  return (
    <header className="stack gap-3" data-hue={hue}>
      <div className="row wrap gap-2">
        <span className="chip chip-hue">Level {module.level} · {module.levelName || module.category}</span>
        <span className="chip">Modul {module.moduleNumber}</span>
        {minutes ? <span className="chip"><Ic name="clock" />±{minutes} menit</span> : null}
        {completed ? <span className="chip chip-success"><Ic name="check-circle" />Tuntas</span> : null}
      </div>
      <h1 className="t-title" id="lesson-title">{module.title}</h1>
      {module.summary ? <p className="t-reading t-muted">{module.summary}</p> : null}
    </header>
  );
}

/**
 * "Di halaman ini" rail (`.toc`) with the active section highlighted and the
 * reading card. `readingRef` receives the card so the page can update its
 * percentage without re-rendering on scroll.
 */
export function LessonToc({ sections = lessonSections, activeSection = "content", onSectionChange = (_section) => {}, readingRef = undefined, minutes = null } = {}) {
  if (!sections.length) return null;
  return (
    <>
      <nav className="stack gap-1" aria-label="Di halaman ini">
        <span className="t-overline t-muted" style={{ padding: "0 10px 4px" }}>Di halaman ini</span>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={cn("toc-link", section.id === activeSection && "is-active")}
            aria-current={section.id === activeSection ? "true" : undefined}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div className="card card-pad-sm stack gap-2 toc-reading" ref={readingRef} style={{ "--p": 0 }} data-minutes={minutes || undefined}>
        <div className="row between"><span className="t-caption t-muted">Dibaca</span><span className="t-caption t-strong t-num" data-reading-value>0%</span></div>
        <div className="bar bar-sm" aria-hidden="true"><i /></div>
        {minutes ? <span className="t-caption t-muted" data-reading-left>Sekitar {minutes} menit lagi</span> : null}
      </div>
    </>
  );
}

/** One lesson section (`.lesson-sect`) with its hue tile and heading. */
export function LessonSection({ id = "", title = "", icon = "lesson", ic = undefined, hue = undefined, children = null, className = "" } = {}) {
  return (
    <section id={id || undefined} className={cn("lesson-sect", className)} aria-labelledby={id ? `${id}-title` : undefined} data-hue={hue}>
      {title ? (
        <div className="lesson-sect-head">
          <span className="tile tile-sm">{ic ? <Ic name={ic} /> : <AapmIcon name={icon} />}</span>
          <h2 id={id ? `${id}-title` : undefined} className="t-section">{title}</h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Observation checklist: canvas `.check` rows with a running count. */
export function LessonChecklist({ items = [], style = "checkbox", density = "comfortable", onCountChange = undefined } = {}) {
  const listId = React.useId();
  const [checked, setChecked] = React.useState(() => new Set());
  if (style === "list") {
    return (
      <ul className="stack gap-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="row-start gap-2 t-body"><Ic name="arrow-right" size="sm" className="t-ink" style={{ marginTop: 3 }} /><span style={{ minWidth: 0 }}>{item}</span></li>
        ))}
      </ul>
    );
  }
  const toggle = (index, on) => setChecked((current) => {
    const next = new Set(current);
    if (on) next.add(index); else next.delete(index);
    onCountChange?.(next.size);
    return next;
  });
  return (
    <div className={cn("stack", density === "compact" ? "gap-2" : "gap-3")}>
      {items.map((item, index) => (
        <label key={`${item}-${index}`} className="check" htmlFor={`${listId}-${index}`}>
          <input id={`${listId}-${index}`} type="checkbox" checked={checked.has(index)} onChange={(event) => toggle(index, event.target.checked)} />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

/** Numbered insights (`.numlist`). */
export function LessonInsightList({ items = [], icon = "insight", density = "comfortable", marker = "number" } = {}) {
  if (marker === "icon") {
    return (
      <ul className={cn("stack", density === "compact" ? "gap-1-5" : "gap-2-5")}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="row-start gap-2 t-body"><AapmIcon name={icon} className="t-ink" /><span style={{ minWidth: 0 }}>{item}</span></li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="numlist" style={density === "compact" ? { gap: 6 } : undefined}>
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ol>
  );
}
