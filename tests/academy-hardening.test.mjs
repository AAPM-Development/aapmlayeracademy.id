import test from "node:test";
import assert from "node:assert/strict";
import {
  createEditorialBlock,
  createEditorialDocument,
  editorialComposerBlocks,
  editorialLearnerNavigationItems,
  ensureEditorialDocument,
  getEditorialQualitySignals,
  parseEditorialDocument,
} from "../src/lib/editorialDocument.js";
import {
  safeEditorialImage,
  safeEditorialLink,
  safeInternalPath,
} from "../src/lib/editorialUrls.js";
import {
  flattenConversationPages,
  removeConversationFromPages,
  upsertConversationInPages,
} from "../src/lib/aiHistoryState.js";
import {
  richTextPlainText,
  sanitizeRichTextDocument,
} from "../src/lib/richTextSafety.js";
import {
  getCompletedModuleSet,
  getNextModule,
  getProgressSummary,
} from "../src/lib/academyData.js";

test("editorial blocks preserve legacy Markdown and normalize a rich-text block", () => {
  const legacy = parseEditorialDocument(JSON.stringify({
    version: 1,
    blocks: [{ id: "legacy", type: "richText", content: "**Bold lama**\n\n- Item" }],
  }));
  assert.equal(legacy.blocks[0].content, "**Bold lama**\n\n- Item");

  const richText = createEditorialBlock("richText");
  const document = createEditorialDocument([richText]);
  assert.equal(document.version, 1);
  assert.equal(document.blocks[0].type, "richText");
  assert.equal(document.blocks[0].content, "");

  assert.equal(createEditorialBlock("heading").content, "");
  assert.equal(createEditorialBlock("link").label, "");
  assert.equal(createEditorialBlock("cta").label, "");
  assert.equal(createEditorialBlock("callout").title, "");
  assert.deepEqual(createEditorialBlock("table").columns, ["", ""]);
  assert.equal(createEditorialBlock("slides").slides[0].title, "");

  const ensured = ensureEditorialDocument(document);
  assert.deepEqual(ensured, document);
});

test("editorial composer preserves one ordered flow of text and media blocks", () => {
  const legacy = createEditorialDocument([
    { id: "heading", type: "heading", content: "Pemeriksaan harian", level: 2 },
    { id: "copy", type: "richText", content: "Gunakan **checklist** ini." },
    { id: "table", type: "table", title: "Target", columns: ["Indikator", "Nilai"], rows: [["Suhu", "24°C"]] },
    { id: "image", type: "image", src: "/uploads/kandang.webp", alt: "Kandang ayam", decorative: false },
    { id: "slides", type: "slides", source: "manual", slides: [{ id: "slide-1", title: "Langkah pertama", content: "Amati kondisi kandang.", src: "/uploads/langkah.webp", alt: "Kandang" }] },
    { id: "link", type: "link", label: "Panduan", url: "/modules/2", description: "Baca referensi lanjutan." },
    { id: "video", type: "video", url: "https://youtu.be/demo", caption: "Video utama" },
  ]);

  const blocks = editorialComposerBlocks(legacy);
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "richText", "table", "image", "slides", "link", "video"]);
  assert.deepEqual(blocks.map((block) => block.id), ["heading", "copy", "table", "image", "slides", "link", "video"]);

  const reordered = [blocks[1], blocks[0], ...blocks.slice(2)];
  const saved = createEditorialDocument(reordered);
  assert.deepEqual(saved.blocks.map((block) => block.id), ["copy", "heading", "table", "image", "slides", "link", "video"]);

  const fallback = editorialComposerBlocks(null, "Narasi awal", "https://youtu.be/fallback");
  assert.deepEqual(fallback.map((block) => block.type), ["richText", "video"]);
  assert.deepEqual(editorialLearnerNavigationItems(legacy).map((item) => item.label), ["Pemeriksaan harian", "Target", "Kandang ayam", "Presentasi", "Panduan", "Video utama"]);
});

test("editorial quality guardrails distinguish incomplete blocks from authoring advice", () => {
  const signals = getEditorialQualitySignals([
    { id: "copy", type: "richText", content: "" },
    { id: "image", type: "image", src: "/uploads/kandang.webp", decorative: true, ratio: "natural", width: "standard" },
    { id: "cta", type: "cta", label: "Mulai", url: "/modules/2" },
    { id: "video", type: "video", url: "https://youtu.be/demo", caption: "" },
  ]);

  assert.ok(signals.some((signal) => signal.severity === "blocking" && signal.blockId === "copy"));
  assert.ok(signals.some((signal) => signal.code === "image-natural-ratio" && signal.blockId === "image"));
  assert.ok(signals.some((signal) => signal.code === "cta-before-video" && signal.blockId === "cta"));
  assert.ok(signals.some((signal) => signal.code === "video-caption" && signal.blockId === "video"));
});

test("editorial URL policy rejects dangerous links and unsafe media paths", () => {
  assert.equal(safeEditorialLink("javascript:alert(1)"), null);
  assert.equal(safeEditorialLink("http://example.com"), null);
  assert.equal(safeEditorialLink("https://example.com/lesson"), "https://example.com/lesson");
  assert.equal(safeEditorialLink("/modules/1"), "/modules/1");
  assert.equal(safeEditorialLink("https://user:pass@example.com/"), null);
  assert.equal(safeInternalPath("//evil.example/path"), null);
  assert.equal(safeInternalPath("/uploads/%2e%2e/secret"), null);
  assert.equal(safeEditorialImage("/uploads/lesson.webp"), "/uploads/lesson.webp");
  assert.equal(safeEditorialImage("/uploads/lesson.svg"), null);
  assert.equal(safeEditorialImage("https://example.com/lesson.jpg"), "https://example.com/lesson.jpg");
});

test("rich-text JSON strips unsupported nodes, marks, and unsafe link attributes", () => {
  const clean = sanitizeRichTextDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "safe", marks: [{ type: "bold" }] },
          { type: "text", text: " bad", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
        ],
      },
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quote" }] }] },
    ],
  });

  assert.equal(clean.content.length, 2);
  assert.deepEqual(clean.content[0].content[0].marks, [{ type: "bold" }]);
  assert.equal(clean.content[0].content[1].marks, undefined);
  assert.equal(richTextPlainText(clean), "safe badquote");
});

test("conversation pages deduplicate, upsert newest metadata, and remove safely", () => {
  const original = {
    pages: [
      { items: [{ id: "c3", title: "three" }, { id: "c2", title: "two" }], total: 3, nextCursor: "next" },
      { items: [{ id: "c1", title: "one" }, { id: "c2", title: "duplicate" }] },
    ],
  };

  assert.deepEqual(
    flattenConversationPages(original).map((item) => item.id),
    ["c3", "c2", "c1"],
  );

  const updated = upsertConversationInPages(original, { id: "c1", title: "updated" });
  assert.deepEqual(updated.pages[0].items.map((item) => item.id), ["c1", "c3", "c2"]);
  assert.equal(updated.pages[0].items[0].title, "updated");
  assert.equal(updated.pages[0].total, 3);
  assert.equal(original.pages[0].items[0].id, "c3");

  const added = upsertConversationInPages(updated, { id: "c4", title: "four" });
  assert.equal(added.pages[0].total, 4);
  assert.equal(added.pages[0].items[0].id, "c4");

  const removed = removeConversationFromPages(added, "c2");
  assert.equal(removed.pages[0].total, 3);
  assert.deepEqual(flattenConversationPages(removed).map((item) => item.id), ["c4", "c1", "c3"]);
});

test("progress metrics count only active catalog modules", () => {
  const modules = [
    { moduleNumber: 1, title: "Satu" },
    { moduleNumber: 2, title: "Dua" },
  ];
  const progress = [
    { moduleNumber: 1, completed: true },
    { moduleNumber: 2, completed: false },
    { moduleNumber: 0, completed: true },
    { moduleNumber: 99, completed: true },
  ];

  assert.deepEqual([...getCompletedModuleSet(progress, modules)], [1]);
  assert.deepEqual(getProgressSummary(modules, progress), {
    completed: 1,
    total: 2,
    percent: 50,
    completedSet: new Set([1]),
  });
  assert.equal(getNextModule(modules, progress)?.moduleNumber, 2);
});
