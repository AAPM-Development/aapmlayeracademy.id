// @ts-nocheck
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Card, CardContent } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import { parseEditorialDocument } from "@/lib/editorialDocument";
import {
  safeEditorialImage as getSafeEditorialImage,
  safeEditorialLink as getSafeEditorialLink,
  safeInternalPath,
} from "@/lib/editorialUrls";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import PptxCarousel from "@/components/academy/PptxCarousel";

export const safeEditorialLink = getSafeEditorialLink;
export const safeEditorialImage = getSafeEditorialImage;

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

// Tiptap's safe Markdown serializer uses ++text++ for underline. Markdown/GFM
// does not define that mark, so turn only this bounded syntax into a real
// semantic <u> node for the renderer. Raw HTML remains disabled by
// react-markdown, and no HTML supplied by the author is passed through here.
function remarkUnderline() {
  return (tree) => {
    const visit = (node) => {
      if (!Array.isArray(node?.children)) return;
      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child?.type === "text" && typeof child.value === "string") {
          const parts = [];
          let cursor = 0;
          const pattern = /\+\+([^+\n]+?)\+\+/g;
          let match;
          while ((match = pattern.exec(child.value))) {
            if (match.index > cursor) parts.push({ type: "text", value: child.value.slice(cursor, match.index) });
            parts.push({
              type: "underline",
              children: [{ type: "text", value: match[1] }],
              data: { hName: "u" },
            });
            cursor = match.index + match[0].length;
          }
          if (parts.length) {
            if (cursor < child.value.length) parts.push({ type: "text", value: child.value.slice(cursor) });
            node.children.splice(index, 1, ...parts);
            index += parts.length - 1;
            continue;
          }
        }
        visit(child);
      }
    };
    visit(tree);
  };
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
  u: ({ children, ...props }) => <u {...props} className="underline decoration-brand-orange/70 underline-offset-2">{children}</u>,
};

export function EditorialMarkdown({ children = "", className = "" }) {
  return (
    <div className={cn("markdown-body min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkUnderline]} components={markdownComponents}>
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
  const hasRowContent = rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim()));
  const hasColumnContent = columns.some((column) => String(column || "").trim());
  const isEmptyDefaultTable = !block.title?.trim()
    && !hasRowContent
    && columns.length === 2
    && columns[0] === "Indikator"
    && columns[1] === "Target";
  if (!columns.length || !rows.length || (!hasColumnContent && !hasRowContent) || isEmptyDefaultTable) return null;
  return (
    <section className="max-w-none">
      {block.title && <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3>}
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
    return <PptxCarousel src={presentation} title={block.title || block.pptxName || "Presentasi"} declaredSlideCount={block.slideCount} />;
  }
  const visibleSlides = slides.filter((slide) => {
    const slideTitle = String(slide?.title || "").trim();
    return Boolean(
      (slideTitle && !/^slide\s+\d+$/i.test(slideTitle))
      || slide?.content?.trim()
      || safeEditorialImage(slide?.src),
    );
  });
  if (!visibleSlides.length) return null;
  const safeIndex = Math.min(activeIndex, visibleSlides.length - 1);
  const slide = visibleSlides[safeIndex];
  const image = safeEditorialImage(slide.src);
  const slideTitle = slide.title?.trim() && !/^slide\s+\d+$/i.test(slide.title.trim()) ? slide.title : "";
  const hasCopy = Boolean(slideTitle || slide.content);
  const canGoBack = safeIndex > 0;
  const canGoForward = safeIndex < visibleSlides.length - 1;
  return (
    <section className="max-w-none">
      {block.title && <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3>}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-subtle shadow-sm">
        <div className={cn("grid min-w-0", image && "lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]")}>
          {image && <div className="aspect-video min-w-0 bg-muted"><img src={image} alt={slide.decorative ? "" : slide.alt || ""} loading="lazy" decoding="async" className="h-full w-full object-cover" /></div>}
          {(hasCopy || !image) && <div className="flex min-h-48 min-w-0 flex-col p-5 sm:p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Slide {safeIndex + 1} dari {visibleSlides.length}</div>
            {slideTitle && <h4 className="mt-2 break-words text-lg font-semibold tracking-[-0.015em] text-foreground">{slideTitle}</h4>}
            {slide.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{slide.content}</p>}
          </div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" disabled={!canGoBack} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}><AapmIcon name="chevronLeft" className="h-3.5 w-3.5" />Sebelumnya</Button>
            <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" disabled={!canGoForward} onClick={() => setActiveIndex((current) => Math.min(visibleSlides.length - 1, current + 1))}>Berikutnya<AapmIcon name="chevronRight" className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex max-w-full flex-wrap justify-end gap-1" aria-label="Pilih slide">
            {visibleSlides.map((item, index) => (
              <button key={item.id || `slide-${index}`} type="button" aria-label={`Tampilkan slide ${index + 1}`} aria-current={index === safeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={cn("rounded-full transition-all", index === safeIndex ? "h-2.5 w-6 bg-brand-orange" : "h-2.5 w-2.5 bg-muted-foreground/30")}/></button>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Slide {safeIndex + 1} dari {visibleSlides.length}</p>
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
  const title = block.title?.trim();
  const content = block.content?.trim();
  if ((!title || title === "Catatan penting") && !content) return null;
  return (
    <Card className={cn("max-w-3xl shadow-none", tone)}>
      <CardContent className="p-4 sm:p-5">
        {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
        {content && <p className="mt-1 text-sm leading-6 text-muted-foreground">{content}</p>}
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
      const content = block.content?.trim();
      return content && content !== "Judul bagian" ? <Heading className="max-w-3xl break-words font-semibold tracking-[-0.015em] text-foreground first:mt-0 [&:not(:first-child)]:mt-8">{content}</Heading> : null;
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
    return typeof fallback === "string" && fallback.trim() ? <EditorialMarkdown>{fallback}</EditorialMarkdown> : null;
  }

  return (
    <div className="min-w-0 space-y-6">
      {editorial.blocks.map((block) => (
        <EditorialBlock key={block.id} block={block} title={title} />
      ))}
    </div>
  );
}
