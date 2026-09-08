import React from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  IconTile,
} from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

const LearningCheckbox = /** @type {any} */ (Checkbox);

export const lessonSections = [
  { id: "content", label: "Materi", icon: "solar:file-text-bold" },
  { id: "video", label: "Video", icon: "solar:play-circle-bold" },
  {
    id: "objectives",
    label: "Tujuan & Insight",
    icon: "solar:target-bold-duotone",
  },
  {
    id: "practical",
    label: "Praktik",
    icon: "solar:clipboard-check-bold-duotone",
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
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
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
            {loadedEmbedSource !== source.src && <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black px-5 text-center text-xs text-white/80" aria-live="polite"><div><AapmIcon name="solar:play-circle-bold" className="mx-auto mb-2 h-6 w-6 text-brand-orange" />Memuat video…</div></div>}
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
    );
  }

  if (mediaUrl) {
    return (
      <Card className="border-tint-orange-border bg-tint-orange shadow-none">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <IconTile icon="solar:shield-warning-bold" tone="orange" size="md" />
          <div className="min-w-0">
            <Badge variant="soft" className="bg-card/70 text-[10px] uppercase tracking-[0.14em] text-foreground">Media dibatasi</Badge>
            <h3 className="mt-2 text-sm font-semibold text-foreground">Tautan video tidak dapat ditampilkan</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Untuk menjaga keamanan lesson, gunakan YouTube, Vimeo, atau file video HTTPS/internal dengan format MP4, WebM, OGG, atau M4V.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function LessonHeader({ module = null, completed = false } = {}) {
  if (!module) return null;
  return (
    <div>
      <Link
        to="/modules"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
          <AapmIcon name="arrowLeft" className="h-3.5 w-3.5" /> Jalur belajar
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-brand-green/30 bg-brand-green/5 text-brand-green"
            >
              Level {module.level}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Modul {module.moduleNumber} · {module.category}
            </span>
          </div>
          <h1 className="break-words text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {module.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {module.summary}
          </p>
        </div>
        {completed && (
          <Badge className="w-fit bg-success text-white">
            <AapmIcon name="check" className="mr-1 h-3.5 w-3.5" /> Selesai
          </Badge>
        )}
      </div>
    </div>
  );
}

export function LessonSidebar({
  module = null,
  activeSection = "content",
  onSectionChange = (_section) => {},
  sections = lessonSections,
} = {}) {
  if (!module) return null;
  return (
    <Card className="shadow-none lg:sticky lg:top-6" aria-label="Peta materi">
      <CardContent className="p-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Peta materi
        </div>
        <div className="space-y-1">
          {sections.map((section) => {
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <AapmIcon name={section.icon} className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function LessonNavigation({
  previous = null,
  next = null,
  onComplete = () => {},
  completeDisabled = false,
  completed = false,
  saving = false,
} = {}) {
  const disabled = completeDisabled || completed || saving;
  const completeLabel = saving
    ? "Menyimpan..."
    : completed
      ? "Modul selesai"
      : "Tandai selesai";

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {previous && (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to={`/modules/${previous.moduleNumber}`}>
              <AapmIcon name="arrowLeft" /> Sebelumnya
            </Link>
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onComplete}
          disabled={disabled}
          aria-busy={saving}
          className="w-full sm:w-auto"
        >
          <AapmIcon name="check" /> {completeLabel}
        </Button>
        {next && (
          <Button
            asChild
            className="bg-brand-orange text-white hover:bg-brand-orange/90"
          >
            <Link to={`/modules/${next.moduleNumber}`}>
              Modul berikutnya <AapmIcon name="arrowRight" />
            </Link>
          </Button>
        )}
        {!next && (
          <Button
            asChild
            className="bg-brand-orange text-white hover:bg-brand-orange/90"
          >
            <Link to="/modules">
              Kembali ke jalur belajar <AapmIcon name="arrowRight" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function LessonSection({
  id = "",
  title = "",
  icon = "solar:file-text-bold",
  children = null,
  className = "",
} = {}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AapmIcon name={icon} className="h-4 w-4 text-brand-orange" /> {title}
      </div>
      {children}
    </section>
  );
}

export function LessonChecklist({ items = [] } = {}) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const id = `checklist-${index}`;
        return (
          <li
            key={`${item}-${index}`}
            className="flex items-start gap-2 text-sm leading-6"
          >
            <LearningCheckbox id={id} className="mt-1" />
            <label htmlFor={id} className="cursor-pointer">
              {item}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function LessonInsightList({
  items = [],
  icon = "solar:lightbulb-bolt-bold-duotone",
} = {}) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6">
          <AapmIcon
            name={icon}
            className="mt-1 h-4 w-4 shrink-0 text-brand-orange"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
