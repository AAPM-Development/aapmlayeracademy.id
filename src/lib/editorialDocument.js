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

export function editorialTextLength(blocks = []) {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((total, block) => {
    const fields = textFieldsByBlockType[block?.type] || [];
    return total + fields.reduce((blockTotal, field) => blockTotal + textByteLength(block?.[field]), 0);
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
    type: "image",
    label: "Gambar / GIF",
    description: "PNG, JPG, WebP, AVIF, atau GIF dari URL aman.",
    icon: "solar:gallery-bold",
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

function normaliseBlock(block, index) {
  if (!block || typeof block !== "object" || !knownBlockTypes.has(block.type)) {
    return null;
  }

  const id = blockIdPattern.test(block.id || "")
    ? block.id
    : `block-${index + 1}`;

  switch (block.type) {
    case "richText":
      return { id, type: "richText", content: text(block.content, 24000) };
    case "heading":
      return {
        id,
        type: "heading",
        content: text(block.content, 500),
        level: select(Number(block.level), [2, 3, 4], 2),
      };
    case "image":
      return {
        id,
        type: "image",
        src: text(block.src, 2048),
        alt: text(block.alt, 280),
        caption: text(block.caption, 600),
        ratio: select(block.ratio, ["natural", "wide", "standard", "square"], "natural"),
        width: select(block.width, ["standard", "wide"], "standard"),
      };
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

export function hasEditorialBlocks(value) {
  return Boolean(parseEditorialDocument(value)?.blocks.length);
}

export function createEditorialBlock(type) {
  const id = makeBlockId();
  switch (type) {
    case "richText":
      return { id, type, content: "Tulis materi di sini. **Markdown** aman didukung." };
    case "heading":
      return { id, type, content: "Judul bagian", level: 2 };
    case "image":
      return { id, type, src: "", alt: "", caption: "", ratio: "natural", width: "standard" };
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
