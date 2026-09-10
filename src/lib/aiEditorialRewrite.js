import {
  createEditorialDocument,
  parseEditorialDocument,
} from "./editorialDocument.js";

const MATERIAL_BLOCK_TYPES = new Set(["richText", "heading", "callout"]);
const MAX_MATERIAL_BLOCKS = 24;
const MAX_RICH_TEXT_LENGTH = 120000;
const MAX_CALLOUT_LENGTH = 2400;
const MAX_MATERIAL_PROMPT_LENGTH = 17000;

const imageMarkdownPattern = /!\[[^\]\r\n]{0,600}\]\(\s*(?:<[^>\r\n]+>|[^)\s\r\n]+)(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'))?\s*\)/g;
const linkMarkdownPattern = /\[[^\]\r\n]{1,600}\]\(\s*(?:<[^>\r\n]+>|[^)\s\r\n]+)(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'))?\s*\)/g;

function boundedText(value, maximum) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function protectRichTextMedia(value) {
  const protectedMedia = [];
  let content = boundedText(value, MAX_RICH_TEXT_LENGTH);
  const protect = (markdown) => {
    const token = `⟦APPI_MEDIA_${protectedMedia.length + 1}⟧`;
    protectedMedia.push({ token, markdown });
    return token;
  };

  // Images are replaced first so their alt text is not accidentally captured
  // by the generic link pattern. The exact Markdown node (including the
  // Tiptap image-layout title) is restored after APPI returns.
  content = content.replace(imageMarkdownPattern, protect);
  content = content.replace(linkMarkdownPattern, protect);
  return { content, protectedMedia };
}

function sourceBlock(block) {
  if (!block || typeof block !== "object" || !MATERIAL_BLOCK_TYPES.has(block.type)) return null;
  const base = { id: String(block.id || ""), type: block.type };
  if (!base.id) return null;

  if (block.type === "richText") {
    const originalContent = boundedText(block.content, MAX_RICH_TEXT_LENGTH);
    const protectedContent = protectRichTextMedia(originalContent);
    return {
      ...base,
      content: protectedContent.content,
      sourceContent: originalContent,
      protectedMedia: protectedContent.protectedMedia,
    };
  }

  if (block.type === "heading") {
    return {
      ...base,
      content: boundedText(block.content, 500),
      level: Number(block.level) || 2,
    };
  }

  const originalContent = boundedText(block.content, MAX_CALLOUT_LENGTH);
  const protectedContent = protectRichTextMedia(originalContent);
  return {
    ...base,
    title: boundedText(block.title, 160),
    content: protectedContent.content,
    sourceContent: originalContent,
    protectedMedia: protectedContent.protectedMedia,
  };
}

/**
 * Return the text-bearing editorial blocks that APPI is allowed to rewrite.
 * Media, tables, buttons, links, and block order remain owned by the editor.
 * A legacy `content` field is represented as the same inline rich-text block
 * the composer creates, so old modules get the same rewrite path.
 */
export function aiEditorialMaterialSource(value, fallback = "") {
  const document = parseEditorialDocument(value);
  const blocks = document?.blocks?.length
    ? document.blocks
    : String(fallback || "").trim()
      ? [{ id: "inline-content", type: "richText", content: fallback }]
      : [];

  return blocks
    .map(sourceBlock)
    .filter(Boolean)
    .slice(0, MAX_MATERIAL_BLOCKS);
}

function promptBlock(block) {
  if (block.type === "heading") {
    return { id: block.id, type: block.type, level: block.level, content: block.content };
  }
  if (block.type === "callout") {
    return { id: block.id, type: block.type, title: block.title, content: block.content };
  }
  return { id: block.id, type: block.type, content: block.content };
}

/**
 * Serialize only a bounded number of complete blocks. Keeping JSON intact is
 * important: a truncated JSON object makes the model guess where formatting
 * starts and ends. Blocks that do not fit remain unchanged in the editor.
 */
export function aiEditorialMaterialPrompt(sourceBlocks = []) {
  if (!Array.isArray(sourceBlocks)) return "[]";
  const selected = [];
  let currentLength = 2;
  for (const block of sourceBlocks) {
    const candidate = promptBlock(block);
    const candidateLength = JSON.stringify(candidate).length + (selected.length ? 2 : 0);
    if (currentLength + candidateLength > MAX_MATERIAL_PROMPT_LENGTH) break;
    selected.push(candidate);
    currentLength += candidateLength;
  }
  return JSON.stringify(selected, null, 2);
}

function stripAiMarkdownFence(value) {
  return boundedText(value, MAX_RICH_TEXT_LENGTH)
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    // Raw executable/embedded tags are never part of the authoring contract.
    // Markdown links/images are left intact and are checked separately below.
    .replace(/<\/?(?:script|style|iframe|object|embed|svg|math|form|input|textarea|select|button)[^>]*>/gi, "")
    .trim();
}

function restoreRichTextMedia(content, protectedMedia) {
  const media = Array.isArray(protectedMedia) ? protectedMedia : [];
  const expectedTokens = media.map((item) => item.token);
  const tokenMatches = content.match(/⟦APPI_MEDIA_\d+⟧/g) || [];
  const hasDirectMedia = imageMarkdownPattern.test(content) || linkMarkdownPattern.test(content);
  imageMarkdownPattern.lastIndex = 0;
  linkMarkdownPattern.lastIndex = 0;

  // The model must echo each protected asset once, in source order, and may
  // not introduce a new URL/image behind the token boundary. Failing closed
  // keeps a rewrite from silently changing the authored media layout.
  const invalidTokens = tokenMatches.length !== expectedTokens.length
    || tokenMatches.some((token, index) => token !== expectedTokens[index]);
  if (hasDirectMedia || invalidTokens) {
    return { restored: content, invalid: true };
  }

  let restored = content;
  for (const item of media) restored = restored.split(item.token).join(item.markdown);
  return { restored, invalid: false };
}

function normaliseMaterialEntry(entry, source) {
  if (!entry || typeof entry !== "object" || !source) return null;
  if (String(entry.type || source.type) !== source.type) return null;

  if (source.type === "heading") {
    const content = stripAiMarkdownFence(entry.content ?? entry.text);
    if (!content) return null;
    return {
      id: source.id,
      type: source.type,
      content: content.replace(/^#{1,6}\s+/, "").slice(0, 500),
    };
  }

  if (source.type === "callout") {
    const rawContent = stripAiMarkdownFence(entry.content);
    if (!rawContent) return null;
    const restored = restoreRichTextMedia(rawContent, source.protectedMedia);
    return {
      id: source.id,
      type: source.type,
      title: boundedText(entry.title ?? source.title, 160).trim() || source.title,
      // If APPI dropped a protected image/link, keep the entire original
      // callout rather than silently deleting authored media.
      content: restored.invalid ? source.sourceContent : restored.restored.slice(0, MAX_CALLOUT_LENGTH),
    };
  }

  const rawContent = stripAiMarkdownFence(entry.content ?? entry.markdown);
  if (!rawContent) return null;
  const restored = restoreRichTextMedia(rawContent, source.protectedMedia);
  return {
    id: source.id,
    type: source.type,
    formatting: "markdown",
    // The fallback is deliberately block-local. Other material blocks can
    // still be previewed/applied if one AI response did not retain its media.
    content: restored.invalid ? source.sourceContent : restored.restored.slice(0, MAX_RICH_TEXT_LENGTH),
  };
}

/**
 * Validate APPI's material response against the source document. Unknown IDs,
 * new block types, and re-ordered blocks are ignored; only existing text
 * blocks can be changed.
 */
export function normaliseAiEditorialMaterial(value, sourceBlocks = []) {
  if (!Array.isArray(value) || !Array.isArray(sourceBlocks)) return [];
  const sourceById = new Map(sourceBlocks.map((block) => [block.id, block]));
  const entriesById = new Map();
  value.forEach((entry) => {
    const source = sourceById.get(String(entry?.id || ""));
    if (!source || entriesById.has(source.id)) return;
    const normalised = normaliseMaterialEntry(entry, source);
    if (normalised) entriesById.set(source.id, normalised);
  });

  // Preserve the source order regardless of the order returned by the model.
  return sourceBlocks
    .map((block) => entriesById.get(block.id))
    .filter(Boolean);
}

function replacementBlock(block, replacement) {
  if (!replacement || replacement.id !== block.id || replacement.type !== block.type) return block;
  if (block.type === "heading") return { ...block, content: replacement.content };
  if (block.type === "callout") return {
    ...block,
    title: replacement.title,
    content: replacement.content,
  };
  return { ...block, content: replacement.content };
}

/**
 * Apply already-confirmed material changes while preserving every non-text
 * block and the document's presentation settings. Returns null when there is
 * nothing safe to apply.
 */
export function applyAiEditorialMaterial(editorialValue, fallback = "", materialBlocks = []) {
  if (!Array.isArray(materialBlocks) || !materialBlocks.length) return null;

  const parsed = parseEditorialDocument(editorialValue);
  const hasParsedBlocks = Boolean(parsed?.blocks?.length);
  const document = hasParsedBlocks ? parsed : (String(fallback || "").trim()
    ? createEditorialDocument([{ id: "inline-content", type: "richText", content: fallback }])
    : null);
  if (!document?.blocks?.length) return null;

  const replacements = new Map(materialBlocks.map((block) => [block.id, block]));
  const nextDocument = parseEditorialDocument({
    ...document,
    blocks: document.blocks.map((block) => replacementBlock(block, replacements.get(block.id))),
  });
  if (!nextDocument) return null;

  return {
    editorialContent: nextDocument,
    // Once a legacy Markdown field is represented as an editorial document,
    // clear the fallback so the learner cannot render the old copy twice.
    content: hasParsedBlocks ? undefined : "",
  };
}

export function aiEditorialMaterialLabel(type) {
  return type === "heading" ? "Judul bagian" : type === "callout" ? "Sorotan" : "Teks kaya";
}
