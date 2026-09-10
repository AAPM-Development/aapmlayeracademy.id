const IMAGE_METADATA_PREFIX = "aapm-image:v1;";
const IMAGE_ALIGNMENTS = new Set(["left", "center", "right"]);

// Rich-text image dimensions are stored as CSS pixels. The editor remains
// responsive because the learner renderer always applies max-width: 100%.
// Keeping the value bounded also prevents an authored document from creating
// an unexpectedly huge layout or an invalid image attribute.
export const RICH_TEXT_IMAGE_MIN_WIDTH = 64;
export const RICH_TEXT_IMAGE_MAX_WIDTH = 2400;
export const RICH_TEXT_IMAGE_MIN_HEIGHT = 32;
export const RICH_TEXT_IMAGE_MAX_HEIGHT = 2400;

export function normaliseRichTextImageWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(RICH_TEXT_IMAGE_MAX_WIDTH, Math.max(RICH_TEXT_IMAGE_MIN_WIDTH, Math.round(number)));
}

export function normaliseRichTextImageHeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(RICH_TEXT_IMAGE_MAX_HEIGHT, Math.max(RICH_TEXT_IMAGE_MIN_HEIGHT, Math.round(number)));
}

export function normaliseRichTextImageAlign(value) {
  return IMAGE_ALIGNMENTS.has(value) ? value : "left";
}

function safeImageTitle(value) {
  if (typeof value !== "string" || !value || value.startsWith(IMAGE_METADATA_PREFIX)) return null;
  return value.slice(0, 160);
}

/**
 * Markdown does not have a native image layout syntax. We keep the document
 * portable by encoding only the bounded layout attributes in the optional
 * image title. A normal title remains supported for legacy content.
 */
export function encodeRichTextImageTitle(attrs = {}) {
  const width = normaliseRichTextImageWidth(attrs.width);
  const height = normaliseRichTextImageHeight(attrs.height);
  const align = normaliseRichTextImageAlign(attrs.align);
  const title = safeImageTitle(attrs.title);
  const params = new URLSearchParams();

  if (width !== null) params.set("w", String(width));
  if (height !== null) params.set("h", String(height));
  if (align !== "left") params.set("a", align);
  if (title) params.set("t", title);

  return params.toString() ? `${IMAGE_METADATA_PREFIX}${params.toString()}` : "";
}

export function parseRichTextImageTitle(value) {
  if (typeof value !== "string" || !value) {
    return { width: null, height: null, align: "left", title: null };
  }

  if (!value.startsWith(IMAGE_METADATA_PREFIX)) {
    return { width: null, height: null, align: "left", title: safeImageTitle(value) };
  }

  const params = new URLSearchParams(value.slice(IMAGE_METADATA_PREFIX.length));
  return {
    width: normaliseRichTextImageWidth(params.get("w")),
    height: normaliseRichTextImageHeight(params.get("h")),
    align: normaliseRichTextImageAlign(params.get("a")),
    title: safeImageTitle(params.get("t")),
  };
}

export function normaliseRichTextImageAttrs(attrs = {}) {
  const parsedTitle = parseRichTextImageTitle(attrs.title);
  return {
    width: normaliseRichTextImageWidth(attrs.width) ?? parsedTitle.width,
    height: normaliseRichTextImageHeight(attrs.height) ?? parsedTitle.height,
    align: normaliseRichTextImageAlign(attrs.align || parsedTitle.align),
    title: safeImageTitle(attrs.title) || parsedTitle.title,
  };
}

function collectImageAttrs(node, images) {
  if (!node || typeof node !== "object") return;
  if (node.type === "image") {
    images.push(node.attrs || {});
    return;
  }
  if (Array.isArray(node.content)) node.content.forEach((child) => collectImageAttrs(child, images));
}

/**
 * Tiptap's stock Markdown image renderer intentionally ignores width/height.
 * Enrich its portable output in document order so existing Markdown stays
 * readable while the layout metadata survives a save and a later reload.
 */
export function enrichRichTextMarkdownImages(markdown, document) {
  if (typeof markdown !== "string" || !markdown) return markdown || "";
  const images = [];
  collectImageAttrs(document, images);
  if (!images.length) return markdown;
  let imageIndex = 0;
  const imagePattern = /!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g;
  return markdown.replace(imagePattern, (match, alt, src, currentTitle) => {
    const attrs = images[imageIndex] || {};
    imageIndex += 1;
    const width = normaliseRichTextImageWidth(attrs.width);
    const height = normaliseRichTextImageHeight(attrs.height);
    const align = normaliseRichTextImageAlign(attrs.align);
    if (width === null && height === null && align === "left") return match;
    const title = encodeRichTextImageTitle({ ...attrs, title: currentTitle || attrs.title });
    return title ? `![${alt}](${src} "${title}")` : match;
  });
}
