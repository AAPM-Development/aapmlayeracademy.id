import { safeEditorialImage, safeEditorialLink } from "./editorialUrls.js";

export const EDITORIAL_DOCUMENT_VERSION = 1;
export const EDITORIAL_TEXT_LIMIT = 120000;

const textFieldsByBlockType = {
  richText: ["content"],
  heading: ["content"],
  image: ["alt", "caption"],
  video: ["caption"],
  link: ["label", "description"],
  cta: ["label"],
  callout: ["title", "content"],
  divider: [],
};

const textByteLength = (value) => {
  const textValue = typeof value === "string" ? value : "";
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(textValue).length;
  }
  return unescape(encodeURIComponent(textValue)).length;
};

function textValuesForBlock(block) {
  if (!block || typeof block !== "object") return [];
  if (block.type === "table") {
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    return [block.title, ...columns, ...rows.flatMap((row) => Array.isArray(row) ? row : [])];
  }
  if (block.type === "slides") {
    if (block.source === "pptx") {
      return [block.title, block.pptxName];
    }
    const slides = Array.isArray(block.slides) ? block.slides : [];
    return [block.title, ...slides.flatMap((slide) => [slide?.title, slide?.content, slide?.alt])];
  }
  return (textFieldsByBlockType[block.type] || []).map((field) => block[field]);
}

export function editorialTextLength(blocks = []) {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((total, block) => {
    return total + textValuesForBlock(block).reduce((blockTotal, value) => blockTotal + textByteLength(value), 0);
  }, 0);
}

export const editorialBlockLibrary = [
  {
    type: "richText",
    label: "Teks kaya",
    description: "Paragraf, daftar, penekanan, dan link Markdown.",
    icon: "solar:file-text-bold",
  },
  {
    type: "heading",
    label: "Judul bagian",
    description: "Membagi materi menjadi bagian yang mudah dipindai.",
    icon: "solar:text-bold",
  },
  {
    type: "table",
    label: "Tabel",
    description: "Baris dan kolom terstruktur yang tetap bisa digeser di layar kecil.",
    icon: "solar:widget-2-bold",
  },
  {
    type: "image",
    label: "Gambar / GIF",
    description: "Unggah PNG, JPG, WebP, AVIF, atau GIF; URL HTTPS tetap tersedia.",
    icon: "solar:gallery-bold",
  },
  {
    type: "slides",
    label: "Slide / galeri",
    description: "Slide manual bergambar atau PPTX yang tampil sebagai carousel learner.",
    icon: "solar:slider-vertical-bold",
  },
  {
    type: "video",
    label: "Video",
    description: "YouTube, Vimeo, atau file video internal.",
    icon: "solar:play-circle-bold",
  },
  {
    type: "link",
    label: "Tautan",
    description: "Referensi atau sumber bacaan dengan konteks.",
    icon: "solar:link-bold",
  },
  {
    type: "cta",
    label: "Tombol aksi",
    description: "CTA dengan gaya produk yang konsisten.",
    icon: "solar:cursor-bold",
  },
  {
    type: "callout",
    label: "Sorotan",
    description: "Catatan penting, praktik, atau perhatian.",
    icon: "solar:lightbulb-bolt-bold-duotone",
  },
  {
    type: "divider",
    label: "Pemisah",
    description: "Membuat ritme antar bagian tetap rapi.",
    icon: "solar:minus-circle-bold",
  },
];

const knownBlockTypes = new Set(editorialBlockLibrary.map((block) => block.type));
const blockIdPattern = /^[A-Za-z0-9_-]{1,80}$/;

const text = (value, maximum = 24000) =>
  typeof value === "string" ? value.slice(0, maximum) : "";

const select = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

function makeBlockId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `block-${crypto.randomUUID()}`;
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeNestedId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEditorialSlide(index = 1) {
  return {
    id: makeNestedId("slide"),
    title: `Slide ${index}`,
    content: "",
    src: "",
    alt: "",
    decorative: true,
  };
}

function normaliseTable(block) {
  const columns = Array.isArray(block.columns)
    ? block.columns.slice(0, 8).map((column) => text(column, 160))
    : [];
  const rows = Array.isArray(block.rows)
    ? block.rows.slice(0, 20).map((row) => columns.map((_, index) => text(Array.isArray(row) ? row[index] : "", 3000)))
    : [];
  return {
    title: text(block.title, 160),
    columns,
    rows,
  };
}

function normaliseSlides(block) {
  const source = block.source === "pptx" ? "pptx" : "manual";
  if (source === "pptx") {
    const rawSlideCount = Number(block.slideCount);
    return {
      title: text(block.title, 160),
      source,
      pptxUrl: text(block.pptxUrl, 2048),
      pptxName: text(block.pptxName, 180),
      slideCount: Number.isInteger(rawSlideCount) && rawSlideCount >= 1 && rawSlideCount <= 50
        ? rawSlideCount
        : 1,
      slides: [],
    };
  }
  const slides = Array.isArray(block.slides) ? block.slides.slice(0, 12) : [];
  return {
    title: text(block.title, 160),
    source,
    slides: slides.map((slide, index) => ({
      id: blockIdPattern.test(slide?.id || "") ? slide.id : `slide-${index + 1}`,
      title: text(slide?.title, 180),
      content: text(slide?.content, 3000),
      src: text(slide?.src, 2048),
      alt: text(slide?.alt, 280),
      decorative: typeof slide?.decorative === "boolean" ? slide.decorative : !text(slide?.alt, 280),
    })),
  };
}

function normaliseBlock(block, index) {
  if (!block || typeof block !== "object" || !knownBlockTypes.has(block.type)) {
    return null;
  }

  const id = blockIdPattern.test(block.id || "")
    ? block.id
    : `block-${index + 1}`;

  switch (block.type) {
    case "richText":
      return { id, type: "richText", content: text(block.content, EDITORIAL_TEXT_LIMIT) };
    case "heading":
      return {
        id,
        type: "heading",
        content: text(block.content, 500),
        level: select(Number(block.level), [2, 3, 4], 2),
      };
    case "table":
      return { id, type: "table", ...normaliseTable(block) };
    case "image":
      {
        const alt = text(block.alt, 280);
        return {
          id,
          type: "image",
          src: text(block.src, 2048),
          alt,
          decorative: typeof block.decorative === "boolean" ? block.decorative : !alt,
          caption: text(block.caption, 600),
          ratio: select(block.ratio, ["natural", "wide", "standard", "square"], "natural"),
          width: select(block.width, ["standard", "wide"], "standard"),
        };
      }
    case "slides":
      return { id, type: "slides", ...normaliseSlides(block) };
    case "video":
      return {
        id,
        type: "video",
        url: text(block.url, 2048),
        caption: text(block.caption, 600),
      };
    case "link":
      return {
        id,
        type: "link",
        label: text(block.label, 160),
        url: text(block.url, 2048),
        description: text(block.description, 600),
      };
    case "cta":
      return {
        id,
        type: "cta",
        label: text(block.label, 120),
        url: text(block.url, 2048),
        variant: select(block.variant, ["primary", "secondary", "outline"], "primary"),
      };
    case "callout":
      return {
        id,
        type: "callout",
        title: text(block.title, 160),
        content: text(block.content, 2400),
        tone: select(block.tone, ["info", "practice", "warning"], "info"),
      };
    case "divider":
      return { id, type: "divider" };
    default:
      return null;
  }
}

export function parseEditorialDocument(value) {
  let document = value;
  if (typeof value === "string") {
    try {
      document = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!document || typeof document !== "object" || !Array.isArray(document.blocks)) {
    return null;
  }

  return {
    version: EDITORIAL_DOCUMENT_VERSION,
    blocks: document.blocks
      .slice(0, 80)
      .map((block, index) => normaliseBlock(block, index))
      .filter(Boolean),
  };
}

export function createEditorialDocument(blocks = []) {
  return {
    version: EDITORIAL_DOCUMENT_VERSION,
    blocks: blocks
      .map((block, index) => normaliseBlock(block, index))
      .filter(Boolean),
  };
}

export function ensureEditorialDocument(value) {
  return parseEditorialDocument(value) || createEditorialDocument();
}

function escapeInlineMarkdown(value, maximum = 24000) {
  return text(value, maximum)
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+\-.!|>])/g, "\\$1")
    .replace(/\r?\n/g, " ")
    .trim();
}

function safeMarkdownLink(value) {
  const safe = safeEditorialLink(value);
  return safe ? `<${safe}>` : "";
}

function markdownImage(block) {
  const source = safeEditorialImage(block?.src || "");
  if (!source) return "";
  const alt = block?.decorative ? "" : escapeInlineMarkdown(block?.alt || "", 280);
  const image = `![${alt}](${safeMarkdownLink(source)})`;
  const caption = escapeInlineMarkdown(block?.caption || "", 600);
  return caption ? `${image}\n\n*${caption}*` : image;
}

function markdownTable(block) {
  const columns = Array.isArray(block?.columns) ? block.columns : [];
  const rows = Array.isArray(block?.rows) ? block.rows : [];
  if (!columns.length || !rows.length) return "";
  const cell = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim() || " ";
  const title = escapeInlineMarkdown(block?.title || "", 160);
  const lines = [
    ...(title ? [`### ${title}`, ""] : []),
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((_, index) => cell(row?.[index])).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function markdownSlides(block) {
  const title = escapeInlineMarkdown(block?.title || block?.pptxName || "", 180);
  if (block?.source === "pptx") {
    const link = safeMarkdownLink(block?.pptxUrl || "");
    if (!link) return title ? `### ${title}` : "";
    return `${title ? `### ${title}\n\n` : ""}[Buka presentasi](${link})`;
  }

  const slides = Array.isArray(block?.slides) ? block.slides : [];
  const sections = slides.map((slide, index) => {
    const parts = [];
    const slideTitle = escapeInlineMarkdown(slide?.title || `Slide ${index + 1}`, 180);
    if (slideTitle) parts.push(`#### ${slideTitle}`);
    const image = markdownImage(slide);
    if (image) parts.push(image);
    if (slide?.content) parts.push(String(slide.content).trim());
    return parts.filter(Boolean).join("\n\n");
  }).filter(Boolean);
  return [title ? `### ${title}` : "", ...sections].filter(Boolean).join("\n\n");
}

function markdownCallout(block) {
  const title = escapeInlineMarkdown(block?.title || "", 160);
  const content = String(block?.content || "").trim();
  const lines = [
    ...(title ? [`> **${title}**`] : []),
    ...(content ? [">", ...content.split(/\r?\n/).map((line) => `> ${line}`)] : []),
  ];
  return lines.join("\n");
}

function inlineMarkdownForBlock(block) {
  if (!block) return "";
  switch (block.type) {
    case "richText":
      return String(block.content || "").trim();
    case "heading": {
      const content = escapeInlineMarkdown(block.content || "", 500);
      return content ? `${"#".repeat(Math.min(3, Math.max(1, Number(block.level) || 2)))} ${content}` : "";
    }
    case "table":
      return markdownTable(block);
    case "image":
      return markdownImage(block);
    case "slides":
      return markdownSlides(block);
    case "link": {
      const label = escapeInlineMarkdown(block.label || "", 160);
      const link = safeMarkdownLink(block.url || "");
      if (!label || !link) return "";
      const description = String(block.description || "").trim();
      return `[${label}](${link})${description ? `\n\n${description}` : ""}`;
    }
    case "cta": {
      const label = escapeInlineMarkdown(block.label || "", 120);
      const link = safeMarkdownLink(block.url || "");
      return label && link ? `[${label}](${link})` : label;
    }
    case "callout":
      return markdownCallout(block);
    case "divider":
      return "---";
    case "video":
      return "";
    default:
      return "";
  }
}

export function editorialInlineContent(value, fallback = "") {
  const document = parseEditorialDocument(value);
  if (!document?.blocks.length) return typeof fallback === "string" ? fallback : "";
  return document.blocks
    // Keep structured elements (slides, images, tables, and callouts) as
    // document blocks. Flattening them into Markdown makes a later text edit
    // silently replace the learner's carousel/object with plain copy.
    .filter((block) => ["richText", "heading"].includes(block.type))
    .map(inlineMarkdownForBlock)
    .filter(Boolean)
    .join("\n\n");
}

export function editorialContentBlocks(value) {
  return ensureEditorialDocument(value).blocks.filter((block) => (
    // Headings are intentionally brought into the Word-like text canvas;
    // keeping them here as well would render them twice after the next save.
    block.type !== "richText" && block.type !== "heading" && block.type !== "video"
  ));
}

export function editorialVideoBlocks(value) {
  return ensureEditorialDocument(value).blocks.filter((block) => block.type === "video");
}

export function createInlineEditorialDocument(content = "", videos = [], richTextId = "inline-content", contentBlocks = []) {
  const blocks = [];
  if (typeof content === "string" && content.trim()) {
    blocks.push({ id: richTextId, type: "richText", content });
  }
  if (Array.isArray(contentBlocks)) blocks.push(...contentBlocks);
  if (Array.isArray(videos)) blocks.push(...videos);
  return createEditorialDocument(blocks);
}

export function hasEditorialBlocks(value) {
  return Boolean(parseEditorialDocument(value)?.blocks.length);
}

export function hasEditorialVideo(value) {
  return ensureEditorialDocument(value).blocks.some((block) => (
    block.type === "video" && typeof block.url === "string" && block.url.trim()
  ));
}

export function createEditorialBlock(type) {
  const id = makeBlockId();
  switch (type) {
    case "richText":
      return { id, type, content: "" };
    case "heading":
      return { id, type, content: "Judul bagian", level: 2 };
    case "table":
      return {
        id,
        type,
        title: "",
        columns: ["Indikator", "Target"],
        rows: [["", ""], ["", ""]],
      };
    case "image":
      return { id, type, src: "", alt: "", decorative: true, caption: "", ratio: "natural", width: "standard" };
    case "slides":
      return { id, type, title: "", source: "manual", slides: [createEditorialSlide(1)] };
    case "video":
      return { id, type, url: "", caption: "" };
    case "link":
      return { id, type, label: "Buka referensi", url: "", description: "" };
    case "cta":
      return { id, type, label: "Lanjutkan", url: "", variant: "primary" };
    case "callout":
      return { id, type, title: "Catatan penting", content: "", tone: "info" };
    case "divider":
      return { id, type };
    default:
      return null;
  }
}
