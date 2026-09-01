// @ts-nocheck
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Card, CardContent } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import { parseEditorialDocument } from "@/lib/editorialDocument";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import PptxCarousel from "@/components/academy/PptxCarousel";

function safeInternalPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  let decoded = path;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  if (decoded.includes("\\") || /[\x00-\x1F\x7F]/.test(decoded) || /(?:^|\/)\.\.?(?:$|\/)/.test(decoded)) return null;
  return path;
}

function safeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeInternalMediaPath(value) {
  const path = safeInternalPath(value);
  return path && /^\/(?:assets|media|uploads)(?:\/|$)/.test(path) ? path : null;
}

export function safeEditorialLink(value) {
  return safeInternalPath(value) || safeHttpsUrl(value);
}

export function safeEditorialImage(value) {
  const safe = safeInternalMediaPath(value) || safeHttpsUrl(value);
  const pathname = safe ? new URL(safe, typeof window === "undefined" ? "https://academy.invalid" : window.location.origin).pathname : "";
  if (!safe || !/\.(?:jpe?g|png|gif|webp|avif)$/i.test(pathname)) return null;
  return safe;
}

function safeEditorialPresentation(value) {
  const safe = safeInternalPath(value);
  if (!safe) return null;
  const pathname = safe.split(/[?#]/, 1)[0];
  return /^\/uploads\/editorial\/presentations\/[0-9]{4}\/[0-9]{2}\/[a-f0-9]{40}\.pptx$/i.test(pathname) ? safe : null;
}

function SafeLink({ href, children, className, ...props }) {
  const safeHref = safeEditorialLink(href);
  if (!safeHref) return <span className={className}>{children}</span>;
  const external = safeHref.startsWith("https://");
  return (
    <a
      {...props}
      href={safeHref}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function MarkdownTable({ children, ...props }) {
  const scrollRef = useScrollEdgeFade();
  return (
    <div ref={scrollRef} className="aapm-scroll-fade aapm-scroll-fade--x aapm-scrollbar my-3 max-w-full overflow-x-auto rounded-xl border border-border" tabIndex={0} aria-label="Tabel materi. Geser horizontal untuk melihat kolom lain.">
      <table {...props}>{children}</table>
    </div>
  );
}

const markdownComponents = {
  a: ({ href, children, ...props }) => (
    <SafeLink
      {...props}
      href={href}
      className="font-medium text-brand-orange underline decoration-brand-orange/35 underline-offset-4 hover:text-brand-orange/80"
    >
      {children}
    </SafeLink>
  ),
  img: ({ src, alt }) => {
    const safeSrc = safeEditorialImage(src);
    if (!safeSrc) return null;
    return (
      <img
        src={safeSrc}
        alt={alt || ""}
        loading="lazy"
        decoding="async"
        className="my-5 h-auto max-w-full rounded-xl border border-border object-contain"
      />
    );
  },
  table: ({ node: _node, children, ...props }) => <MarkdownTable {...props}>{children}</MarkdownTable>,
  th: ({ node: _node, children, ...props }) => <th {...props} scope="col">{children}</th>,
};

export function EditorialMarkdown({ children = "", className = "" }) {
  return (
    <div className={cn("markdown-body min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const calloutTone = {
  info: "border-brand-green/20 bg-brand-green/5 text-brand-green",
  practice: "border-brand-orange/20 bg-brand-orange/5 text-brand-orange",
  warning: "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300",
};

const imageRatio = {
  natural: "",
  wide: "aspect-video",
  standard: "aspect-[4/3]",
  square: "aspect-square",
};

function ImageBlock({ block }) {
  const src = safeEditorialImage(block.src);
  if (!src) return null;
  return (
    <figure className={cn("max-w-full", block.width === "wide" ? "lg:-mx-4" : "max-w-4xl")}>
      <div className={cn("overflow-hidden rounded-2xl border border-border bg-muted", imageRatio[block.ratio] || "")}>
        <img
          src={src}
          alt={block.decorative ? "" : block.alt || ""}
          loading="lazy"
          decoding="async"
          className={cn("h-full w-full max-w-full", block.ratio === "natural" ? "h-auto object-contain" : "object-cover")}
        />
      </div>
      {block.caption && <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{block.caption}</figcaption>}
    </figure>
  );
}

function TableBlock({ block }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const scrollRef = useScrollEdgeFade();
  if (!columns.length || !rows.length) return null;
  return (
    <section className="max-w-none">
      {block.title && <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3>}
      <p className="mb-2 text-[11px] leading-5 text-muted-foreground">Geser horizontal bila semua kolom belum terlihat.</p>
      <div ref={scrollRef} className="aapm-scroll-fade aapm-scroll-fade--x aapm-scrollbar max-w-full overflow-x-auto rounded-xl border border-border bg-background" tabIndex={0} aria-label={block.title ? `Tabel ${block.title}. Geser horizontal untuk melihat kolom lain.` : "Tabel materi. Geser horizontal untuk melihat kolom lain."}>
        <table className="min-w-full w-max border-collapse text-sm">
          {block.title && <caption className="sr-only">{block.title}</caption>}
          <thead className="bg-surface-subtle">
            <tr>
              {columns.map((column, index) => <th key={`heading-${index}`} scope="col" className="min-w-32 border border-border px-3 py-2 text-left font-semibold text-foreground">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="align-top even:bg-surface-subtle/55">
                {columns.map((_, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`} className="min-w-32 whitespace-pre-wrap break-words border border-border px-3 py-2 leading-6 text-foreground">{row?.[columnIndex] || ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SlidesBlock({ block }) {
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const [activeIndex, setActiveIndex] = React.useState(0);
  const presentation = block.source === "pptx" ? safeEditorialPresentation(block.pptxUrl) : null;
  if (presentation) {
    return <PptxCarousel src={presentation} title={block.title || block.pptxName || "Presentasi pembelajaran"} declaredSlideCount={block.slideCount} />;
  }
  if (!slides.length) return null;
  const safeIndex = Math.min(activeIndex, slides.length - 1);
  const slide = slides[safeIndex];
  const image = safeEditorialImage(slide.src);
  const hasCopy = Boolean(slide.title || slide.content);
  const canGoBack = safeIndex > 0;
  const canGoForward = safeIndex < slides.length - 1;
  return (
    <section className="max-w-none">
      {block.title && <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3>}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-subtle shadow-sm">
        <div className={cn("grid min-w-0", image && "lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]")}>
          {image && <div className="aspect-video min-w-0 bg-muted"><img src={image} alt={slide.decorative ? "" : slide.alt || ""} loading="lazy" decoding="async" className="h-full w-full object-cover" /></div>}
          {(hasCopy || !image) && <div className="flex min-h-48 min-w-0 flex-col p-5 sm:p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Slide {safeIndex + 1} dari {slides.length}</div>
            {slide.title && <h4 className="mt-2 break-words text-lg font-semibold tracking-[-0.015em] text-foreground">{slide.title}</h4>}
            {slide.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{slide.content}</p>}
            {!slide.title && !slide.content && !image && <p className="text-sm text-muted-foreground">Slide belum memiliki isi.</p>}
          </div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" disabled={!canGoBack} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}><AapmIcon name="chevronLeft" className="h-3.5 w-3.5" />Sebelumnya</Button>
            <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" disabled={!canGoForward} onClick={() => setActiveIndex((current) => Math.min(slides.length - 1, current + 1))}>Berikutnya<AapmIcon name="chevronRight" className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex max-w-full flex-wrap justify-end gap-1" aria-label="Pilih slide">
            {slides.map((item, index) => (
              <button key={item.id || `slide-${index}`} type="button" aria-label={`Tampilkan slide ${index + 1}`} aria-current={index === safeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={cn("rounded-full transition-all", index === safeIndex ? "h-2.5 w-6 bg-brand-orange" : "h-2.5 w-2.5 bg-muted-foreground/30")}/></button>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Slide {safeIndex + 1} dari {slides.length}</p>
    </section>
  );
}

function CtaBlock({ block }) {
  const href = safeEditorialLink(block.url);
  if (!href || !block.label) return null;
  const variant = block.variant === "secondary" ? "secondary" : block.variant === "outline" ? "outline" : "default";
  const external = href.startsWith("https://");
  return (
    <Button asChild variant={variant} className="max-w-full whitespace-normal text-left">
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {block.label} <AapmIcon name="arrowRight" className="shrink-0" />
      </a>
    </Button>
  );
}

function LinkBlock({ block }) {
  const href = safeEditorialLink(block.url);
  if (!href || !block.label) return null;
  const external = href.startsWith("https://");
  return (
    <Card className="max-w-3xl border-border shadow-none">
      <CardContent className="flex min-w-0 items-start gap-3 p-4">
        <AapmIcon name="link" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
        <div className="min-w-0">
          <a
            href={href}
            className="break-words text-sm font-semibold text-foreground underline decoration-brand-orange/35 underline-offset-4 hover:text-brand-orange"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {block.label}
          </a>
          {block.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CalloutBlock({ block }) {
  const tone = calloutTone[block.tone] || calloutTone.info;
  return (
    <Card className={cn("max-w-3xl shadow-none", tone)}>
      <CardContent className="p-4 sm:p-5">
        {block.title && <div className="text-sm font-semibold text-foreground">{block.title}</div>}
        {block.content && <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.content}</p>}
      </CardContent>
    </Card>
  );
}

function EditorialBlock({ block, title }) {
  switch (block.type) {
    case "richText":
      return block.content ? <EditorialMarkdown>{block.content}</EditorialMarkdown> : null;
    case "heading": {
      const Heading = `h${block.level || 2}`;
      return block.content ? <Heading className="max-w-3xl break-words font-semibold tracking-[-0.015em] text-foreground first:mt-0 [&:not(:first-child)]:mt-8">{block.content}</Heading> : null;
    }
    case "table":
      return <TableBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "slides":
      return <SlidesBlock block={block} />;
    case "video":
      return (
        <div className="max-w-4xl">
          <LessonMedia module={{ title, videoUrl: block.url }} />
          {block.caption && <p className="mt-2 text-xs leading-5 text-muted-foreground">{block.caption}</p>}
        </div>
      );
    case "link":
      return <LinkBlock block={block} />;
    case "cta":
      return <CtaBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "divider":
      return <hr className="max-w-3xl border-border" />;
    default:
      return null;
  }
}

export function EditorialContent({ document, fallback = "", title = "Materi modul" }) {
  const editorial = parseEditorialDocument(document);
  if (!editorial?.blocks.length) {
    return <EditorialMarkdown>{fallback || "Konten modul sedang disiapkan."}</EditorialMarkdown>;
  }

  return (
    <div className="min-w-0 space-y-6">
      {editorial.blocks.map((block) => (
        <EditorialBlock key={block.id} block={block} title={title} />
      ))}
    </div>
  );
}
