import React from "react";
import { Alert, Badge, CheckboxField, IconTile } from "@/design-system";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

export const lessonSections = [
  { id: "content", label: "Materi", icon: "lesson" },
  { id: "video", label: "Video", icon: "video" },
  {
    id: "objectives",
    label: "Tujuan & Insight",
    icon: "target",
  },
  {
    id: "practical",
    label: "Praktik",
    icon: "practice",
  },
];

function safeInternalVideoPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || /(?:^|\/)\.\.?($|\/)/.test(path)) return null;
  if (!/^\/(?:assets|media|uploads)(?:\/|$)/.test(path)) return null;
  return /\.(mp4|webm|ogg|m4v)(?:[?#]|$)/i.test(path) ? path : null;
}

export function trustedVideoSource(value) {
  const internalPath = safeInternalVideoPath(value);
  if (internalPath) return { kind: "file", src: internalPath };

  try {
    const source = new URL(value);
    if (source.protocol !== "https:" || !source.hostname || source.username || source.password) {
      return null;
    }
    const hostname = source.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtu.be") {
      const id = source.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id)
        ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }
        : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
      const id =
        source.searchParams.get("v") ||
        source.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/)?.[1];
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id)
        ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }
        : null;
    }

    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      const id = source.pathname.match(/\/(\d+)(?:\/|$)/)?.[1];
      return id ? { kind: "embed", src: `https://player.vimeo.com/video/${id}` } : null;
    }

    if (/\.(mp4|webm|ogg|m4v)$/i.test(source.pathname)) {
      return { kind: "file", src: source.toString() };
    }
  } catch {
    return null;
  }

  return null;
}

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
    const provider = /vimeo/.test(source.src) ? "Vimeo" : "YouTube";
    return (
      <>
      <div className="aapm-lesson-media">
        {source.kind === "file" ? (
          <video
            className="absolute inset-0 h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
            src={source.src}
          />
        ) : (
          <>
            {loadedEmbedSource !== source.src && <div className="aapm-lesson-media__loading" aria-live="polite"><span className="aapm-spinner" aria-hidden="true" />Memuat video…</div>}
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
          </>
        )}
      </div>
      {source.kind === "embed" ? (
        <p className="aapm-lesson-media__fallback">
          Video tidak muncul?{" "}
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            Buka di {provider}<AapmIcon name="externalLink" /><span className="aapm-visually-hidden"> (tab baru)</span>
          </a>
        </p>
      ) : null}
      </>
    );
  }

  if (mediaUrl) {
    return (
      <Alert
        tone="warning"
        icon="shieldWarning"
        title="Tautan video tidak dapat ditampilkan"
        description="Untuk menjaga keamanan lesson, gunakan YouTube, Vimeo, atau file video HTTPS/internal (MP4, WebM, OGG, M4V)."
      />
    );
  }

  return null;
}

/** Lesson title block: level chip, module meta, title and summary. */
export function LessonHeader({ module = null, completed = false, hue = "green", minutes = null } = {}) {
  if (!module) return null;
  return (
    <header className="aapm-lesson__header">
      <div className="aapm-meta-row">
        <Badge hue={hue}>Level {module.level} · {module.levelName || module.category}</Badge>
        <span className="aapm-meta"><AapmIcon name="modules" />Modul {module.moduleNumber}</span>
        {minutes ? <span className="aapm-meta"><AapmIcon name="clock" />±{minutes} menit</span> : null}
        {completed ? <Badge tone="success" icon="check">Selesai</Badge> : null}
      </div>
      <h1 className="aapm-lesson__title">{module.title}</h1>
      {module.summary ? <p className="aapm-lesson__summary">{module.summary}</p> : null}
    </header>
  );
}

/** "Di halaman ini" table of contents with the active section highlighted. */
export function LessonToc({ sections = lessonSections, activeSection = "content", onSectionChange = (_section) => {} } = {}) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Di halaman ini">
      <p className="aapm-toc__title aapm-text-overline">Di halaman ini</p>
      <div className="aapm-toc">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="aapm-toc__link"
            aria-current={section.id === activeSection ? "true" : undefined}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function LessonSection({ id = "", title = "", icon = "lesson", hue = "green", children = null, className = "" } = {}) {
  return (
    <section id={id || undefined} className={cn("aapm-lesson-section", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      {title ? (
        <div className="aapm-lesson-section__head">
          <IconTile icon={icon} hue={hue} size="sm" shape="circle" />
          <h2 id={id ? `${id}-title` : undefined} className="aapm-lesson-section__title">{title}</h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LessonChecklist({ items = [], style = "checkbox", density = "comfortable" } = {}) {
  const listId = React.useId();
  return (
    <ul className={cn("aapm-lesson-checklist", density === "compact" && "aapm-lesson-checklist--compact")}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          {style === "list" ? (
            <span className="aapm-lesson-checklist__item">
              <AapmIcon name="arrowRight" />
              <span className="min-w-0">{item}</span>
            </span>
          ) : (
            <CheckboxField id={`${listId}-checklist-${index}`} label={item} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function LessonInsightList({ items = [], icon = "insight", density = "comfortable", marker = "number" } = {}) {
  return (
    <ol className={cn("aapm-lesson-insight-list", density === "compact" && "aapm-lesson-insight-list--compact")}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="aapm-lesson-insight-item grid">
          {marker === "icon" ? (
            <AapmIcon name={icon} className="aapm-lesson-insight-icon" />
          ) : (
            <span aria-hidden="true" className="aapm-lesson-insight-index">{index + 1}</span>
          )}
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}
