import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Card, CardContent } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { parseEditorialDocument } from "@/lib/editorialDocument";
import { LessonMedia } from "@/components/academy/LessonWorkspace";

function safeInternalPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || /(?:^|\/)\.\.?($|\/)/.test(path)) return null;
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

export function safeEditorialLink(value) {
  return safeInternalPath(value) || safeHttpsUrl(value);
}

export function safeEditorialImage(value) {
  const safe = safeEditorialLink(value);
  if (!safe || /\.svg(?:[?#]|$)/i.test(safe)) return null;
  return safe;
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
    <figure className={cn("max-w-full", block.width === "wide" ? "lg:-mx-3" : "max-w-3xl")}>
      <div className={cn("overflow-hidden rounded-2xl border border-border bg-muted", imageRatio[block.ratio] || "")}>
        <img
          src={src}
          alt={block.alt || ""}
          loading="lazy"
          decoding="async"
          className={cn("h-full w-full max-w-full", block.ratio === "natural" ? "h-auto object-contain" : "object-cover")}
        />
      </div>
      {block.caption && <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{block.caption}</figcaption>}
    </figure>
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
    case "image":
      return <ImageBlock block={block} />;
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
    <div className="min-w-0 space-y-6 overflow-hidden">
      {editorial.blocks.map((block) => (
        <EditorialBlock key={block.id} block={block} title={title} />
      ))}
    </div>
  );
}
