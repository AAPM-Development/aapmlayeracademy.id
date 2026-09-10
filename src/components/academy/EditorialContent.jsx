// @ts-nocheck
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { editorialBlockAnchorId, parseEditorialDocument } from "@/lib/editorialDocument";
import {
  safeEditorialImage as getSafeEditorialImage,
  safeEditorialLink as getSafeEditorialLink,
} from "@/lib/editorialUrls";
import { parseRichTextImageTitle } from "@/lib/richTextImageLayout";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import EditorialPresentation from "@/components/academy/EditorialPresentation";

export const safeEditorialLink = getSafeEditorialLink;
export const safeEditorialImage = getSafeEditorialImage;

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
  return (
    <Table
      {...props}
      className="aapm-editorial-table"
      aria-label="Tabel materi. Geser horizontal untuk melihat kolom lain."
    >
      {children}
    </Table>
  );
}

const markdownComponents = {
  h1: ({ node: _node, children, className, ...props }) => (
    // The lesson title already owns the document H1. Author-entered H1 text is
    // visually retained but rendered as an H2 so the learner page keeps a
    // meaningful heading hierarchy.
    <h2 {...props} className={cn("mb-3 mt-7 text-xl font-semibold tracking-[-0.015em] text-foreground", className)}>{children}</h2>
  ),
  a: ({ href, children, ...props }) => (
    <SafeLink
      {...props}
      href={href}
      className="font-medium text-brand-orange underline decoration-brand-orange/35 underline-offset-4 hover:text-brand-orange/80"
    >
      {children}
    </SafeLink>
  ),
  img: ({ src, alt, title }) => {
    const safeSrc = safeEditorialImage(src);
    if (!safeSrc) return null;
    const layout = parseRichTextImageTitle(title);
    const style = layout.width ? { width: `${layout.width}px`, maxWidth: "100%" } : undefined;
    const alignment = {
      left: "mr-auto",
      center: "mx-auto",
      right: "ml-auto",
    }[layout.align] || "mr-auto";
    return (
      <img
        src={safeSrc}
        alt={alt || ""}
        title={layout.title || undefined}
        loading="lazy"
        decoding="async"
        style={style}
        className={cn("my-5 block h-auto max-w-full rounded-xl object-contain", alignment)}
      />
    );
  },
  table: ({ node: _node, children, ...props }) => <MarkdownTable {...props}>{children}</MarkdownTable>,
  th: ({ node: _node, children, ...props }) => <th {...props} scope="col">{children}</th>,
  u: ({ children, ...props }) => <u {...props} className="underline decoration-brand-orange/70 underline-offset-2">{children}</u>,
};

export function EditorialMarkdown({ children = "", className = "" }) {
  return (
    <div className={cn("markdown-body min-w-0 max-w-[var(--aapm-reading-measure)] break-words text-base leading-7", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkUnderline]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const calloutTone = {
  info: "border-brand-green/20 bg-brand-green/5 text-brand-green",
  practice: "border-brand-orange/20 bg-brand-orange/5 text-brand-orange",
  warning: "border-tint-orange-border bg-tint-orange text-tint-orange-foreground",
  blue: "border-tint-blue-border bg-tint-blue text-tint-blue-foreground",
  violet: "border-tint-violet-border bg-tint-violet text-tint-violet-foreground",
  neutral: "border-border bg-surface-subtle text-muted-foreground",
};

const calloutVariant = {
  soft: "",
  solid: "border-transparent",
  outline: "bg-background",
};

const calloutSolidTone = {
  info: "border-brand-green bg-brand-green",
  practice: "border-brand-orange bg-brand-orange",
  warning: "border-tint-orange-foreground bg-tint-orange-foreground",
  blue: "border-tint-blue-foreground bg-tint-blue-foreground",
  violet: "border-tint-violet-foreground bg-tint-violet-foreground",
  neutral: "border-foreground bg-foreground",
};

const calloutIcon = {
  info: "info",
  target: "target",
  warning: "warning",
  check: "checkRead",
};

const calloutWidth = {
  standard: "max-w-3xl",
  wide: "max-w-5xl",
};

const calloutDensity = {
  comfortable: "p-4 sm:p-5",
  compact: "p-3 sm:p-4",
};

const linkTone = {
  neutral: "border-border bg-background",
  green: "border-brand-green/20 bg-brand-green/5",
  orange: "border-brand-orange/20 bg-brand-orange/5",
  blue: "border-tint-blue-border bg-tint-blue",
  violet: "border-tint-violet-border bg-tint-violet",
};

const linkTextTone = {
  neutral: "text-foreground",
  green: "text-brand-green",
  orange: "text-brand-orange",
  blue: "text-tint-blue-foreground",
  violet: "text-tint-violet-foreground",
};

const imageRatio = {
  natural: "",
  wide: "aspect-video",
  standard: "aspect-[4/3]",
  square: "aspect-square",
};

const imageAlignment = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

const imagePosition = {
  top: "object-top",
  center: "object-center",
  bottom: "object-bottom",
};

const ctaAlignment = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const ctaIcon = {
  arrowRight: "arrowRight",
  check: "checkRead",
  play: "play",
};

const ctaRadius = {
  sm: "sm",
  md: "md",
  lg: "lg",
  pill: "pill",
};

function linkTargetProps(href, target = "auto") {
  const external = href.startsWith("https://");
  const opensNewTab = target === "new" || (target === "auto" && external);
  if (!opensNewTab) return {};
  return {
    target: "_blank",
    ...(external ? { rel: "noopener noreferrer" } : {}),
  };
}

const textAlignment = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const blockAlignment = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

const dividerStyle = {
  subtle: "border-border",
  strong: "border-foreground/35 border-t-2",
  dashed: "border-dashed border-border",
};

const dividerSpacing = {
  compact: "my-3",
  comfortable: "my-8",
};

function ImageBlock({ block }) {
  const src = safeEditorialImage(block.src);
  if (!src) return null;
  return (
    <figure className={cn("max-w-full", block.width === "wide" ? "lg:-mx-4" : "max-w-4xl", imageAlignment[block.align] || imageAlignment.left)}>
      <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted", imageRatio[block.ratio] || "")}>
        <img
          src={src}
          alt={block.decorative ? "" : block.alt || ""}
          loading="lazy"
          decoding="async"
          className={cn("block max-w-full", block.ratio === "natural" ? "h-auto w-auto object-contain" : "h-full w-full object-cover", imageAlignment[block.align] || imageAlignment.left, imagePosition[block.position] || imagePosition.center)}
        />
      </div>
      {block.caption && <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{block.caption}</figcaption>}
    </figure>
  );
}

function TableBlock({ block }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
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
      {block.title && <h3 className={cn("mb-3 text-sm font-semibold text-foreground", textAlignment[block.align] || textAlignment.left)}>{block.title}</h3>}
      <div className={cn("w-max max-w-full overflow-x-auto", blockAlignment[block.align] || blockAlignment.left)}>
        <Table className={cn("aapm-editorial-table w-max", block.density === "compact" ? "text-xs" : "text-sm")} aria-label={block.title ? `Tabel ${block.title}. Geser horizontal untuk melihat kolom lain.` : "Tabel materi. Geser horizontal untuk melihat kolom lain."}>
          {block.title && <TableCaption className="sr-only">{block.title}</TableCaption>}
          <TableHeader>
            <TableRow className={block.density === "compact" ? "[&>th]:py-2 [&>td]:py-2" : undefined}>
              {columns.map((column, index) => <TableHead key={`heading-${index}`} scope="col" className="min-w-32 whitespace-nowrap">{column}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={`row-${rowIndex}`} className={cn("align-top", block.density === "compact" && "[&>th]:py-2 [&>td]:py-2")}>
                {columns.map((_, columnIndex) => <TableCell key={`cell-${rowIndex}-${columnIndex}`} className="min-w-32 whitespace-pre-wrap break-words leading-6">{row?.[columnIndex] || ""}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function SlidesBlock({ block }) {
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const [activeIndex, setActiveIndex] = React.useState(0);
  const presentationUrl = block.presentationUrl || block.pptxUrl;
  if (presentationUrl && block.source && block.source !== "manual") {
    return <div className={cn("max-w-full", blockAlignment[block.align] || blockAlignment.left)}><EditorialPresentation src={presentationUrl} format={block.presentationFormat || block.source} title={block.title || block.presentationName || block.pptxName || "Presentasi"} name={block.presentationName || block.pptxName} declaredSlideCount={block.slideCount} /></div>;
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
    <section className={cn("max-w-none", blockAlignment[block.align] || blockAlignment.left)}>
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
  const icon = block.icon && block.icon !== "none" ? ctaIcon[block.icon] || "arrowRight" : "";
  return (
    <div className={cn("flex w-full", ctaAlignment[block.align] || ctaAlignment.left)}>
      <Button
        asChild
        variant={variant}
        size={block.size || "md"}
        data-editorial-cta-tone={block.tone || "green"}
        data-editorial-cta-variant={block.variant || "primary"}
        data-editorial-cta-radius={ctaRadius[block.radius] || ctaRadius.md}
        className={cn("max-w-full whitespace-normal text-left", block.width === "full" && "w-full")}
      >
        <a href={href} {...linkTargetProps(href, block.target)}>
          {block.label} {icon && <AapmIcon name={icon} className="shrink-0" />}
        </a>
      </Button>
    </div>
  );
}

function LinkBlock({ block }) {
  const href = safeEditorialLink(block.url);
  if (!href || !block.label) return null;
  const icon = block.icon && block.icon !== "none" ? block.icon : "";
  const variant = block.variant || "card";
  const tone = block.tone || "neutral";
  const content = (
    <CardContent className={cn("flex min-w-0 items-start gap-3", variant === "inline" ? "px-0 py-1" : "p-4")}>
      {icon && <AapmIcon name={icon} className={cn("mt-0.5 h-4 w-4 shrink-0", linkTextTone[tone] || linkTextTone.neutral)} />}
      <div className={cn("min-w-0", textAlignment[block.align] || textAlignment.left)}>
        <a
          href={href}
          className={cn("break-words text-sm font-semibold underline decoration-brand-orange/35 underline-offset-4 hover:text-brand-orange", linkTextTone[tone] || linkTextTone.neutral)}
          {...linkTargetProps(href, block.target)}
        >
          {block.label}
        </a>
        {block.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>}
      </div>
    </CardContent>
  );
  return (
    <Card className={cn(calloutWidth[block.width] || calloutWidth.standard, "shadow-none", variant === "inline" ? "border-transparent bg-transparent" : variant === "soft" ? "bg-surface-subtle" : (linkTone[tone] || linkTone.neutral), blockAlignment[block.align] || blockAlignment.left)}>
      {content}
    </Card>
  );
}

function CalloutBlock({ block }) {
  const tone = calloutTone[block.tone] || calloutTone.info;
  const style = calloutVariant[block.variant] || calloutVariant.soft;
  const solidTone = block.variant === "solid" ? calloutSolidTone[block.tone] || calloutSolidTone.info : "";
  const icon = block.icon && block.icon !== "none" ? calloutIcon[block.icon] || "info" : "";
  const title = block.title?.trim();
  const content = block.content?.trim();
  if ((!title || title === "Catatan penting") && !content) return null;
  return (
    <Card className={cn(calloutWidth[block.width] || calloutWidth.standard, "shadow-none", tone, style, solidTone, block.variant === "solid" && "text-white", blockAlignment[block.align] || blockAlignment.left)}>
      <CardContent className={calloutDensity[block.density] || calloutDensity.comfortable}>
        <div className={cn("flex items-start gap-3", textAlignment[block.align] || textAlignment.left)}>
          {icon && <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/70", block.variant === "solid" ? "text-current" : "text-brand-orange")}><AapmIcon name={icon} className="h-4 w-4" /></span>}
          <div className="min-w-0 flex-1">
            {title && <div className={cn("text-sm font-semibold", block.variant === "solid" ? "text-white" : "text-foreground")}>{title}</div>}
            {content && <p className={cn("mt-1 text-sm leading-6", block.variant === "solid" ? "text-white/80" : "text-muted-foreground")}>{content}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditorialBlock({ block, title }) {
  switch (block.type) {
    case "richText":
      return block.content ? <EditorialMarkdown className={textAlignment[block.align] || textAlignment.left}>{block.content}</EditorialMarkdown> : null;
    case "heading": {
      const Heading = `h${block.level || 2}`;
      const content = block.content?.trim();
      return content && content !== "Judul bagian" ? <Heading className={cn("max-w-3xl break-words font-semibold tracking-[-0.015em] text-foreground first:mt-0 [&:not(:first-child)]:mt-8", textAlignment[block.align] || textAlignment.left)}>{content}</Heading> : null;
    }
    case "table":
      return <TableBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "slides":
      return <SlidesBlock block={block} />;
    case "video":
      return (
        <div className={cn("max-w-4xl", blockAlignment[block.align] || blockAlignment.left)}>
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
      return <hr className={cn("max-w-3xl border-t", dividerStyle[block.style] || dividerStyle.subtle, dividerSpacing[block.spacing] || dividerSpacing.comfortable)} />;
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
        <div key={block.id} id={editorialBlockAnchorId(block.id)} className="scroll-mt-24">
          <EditorialBlock block={block} title={title} />
        </div>
      ))}
    </div>
  );
}
