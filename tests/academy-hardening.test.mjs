import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  isConversationArchived,
  removeConversationFromPages,
  upsertConversationInPages,
} from "../src/lib/aiHistoryState.js";
import {
  richTextPlainText,
  sanitizeRichTextDocument,
} from "../src/lib/richTextSafety.js";
import {
  encodeRichTextImageTitle,
  enrichRichTextMarkdownImages,
  parseRichTextImageTitle,
} from "../src/lib/richTextImageLayout.js";
import {
  getCompletedModuleSet,
  getNextModule,
  getProgressSummary,
} from "../src/lib/academyData.js";
import {
  EDITORIAL_PRESENTATION_MAX_BYTES,
  EDITORIAL_PRESENTATION_MAX_SLIDES,
} from "../src/lib/editorialLimits.js";
import { normaliseSvgBlipMarkup } from "../src/lib/pptxCompatibility.js";
import {
  EDITORIAL_PRESENTATION_ACCEPT,
  getEditorialPresentationFormatFromName,
  getEditorialPresentationFormatFromUrl,
} from "../src/lib/editorialPresentation.js";

const readWorkspaceFile = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

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

test("PPTX authoring and learner limits stay on the 50 MB contract", () => {
  assert.equal(EDITORIAL_PRESENTATION_MAX_BYTES, 50 * 1024 * 1024);
  assert.equal(EDITORIAL_PRESENTATION_MAX_SLIDES, 50);
});

test("editorial presentation compatibility keeps common formats explicit", () => {
  assert.equal(getEditorialPresentationFormatFromName("materi.PPTX"), "pptx");
  assert.equal(getEditorialPresentationFormatFromName("materi.ppt"), "ppt");
  assert.equal(getEditorialPresentationFormatFromName("materi.key"), "key");
  assert.equal(getEditorialPresentationFormatFromName("materi.odp"), "odp");
  assert.equal(getEditorialPresentationFormatFromName("materi.pdf"), "pdf");
  assert.equal(getEditorialPresentationFormatFromName("materi.exe"), null);
  assert.equal(getEditorialPresentationFormatFromUrl("/uploads/editorial/presentations/2026/09/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.key"), "key");
  assert.match(EDITORIAL_PRESENTATION_ACCEPT, /\.pptx/);
  assert.match(EDITORIAL_PRESENTATION_ACCEPT, /\.key/);
  assert.match(EDITORIAL_PRESENTATION_ACCEPT, /application\/pdf/);

  const parsed = parseEditorialDocument(JSON.stringify({
    version: 1,
    blocks: [{
      id: "pdf",
      type: "slides",
      source: "pdf",
      presentationUrl: "/uploads/editorial/presentations/2026/09/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf",
      presentationName: "materi.pdf",
    }],
  }));
  assert.equal(parsed.blocks[0].source, "pdf");
  assert.equal(parsed.blocks[0].presentationUrl.endsWith(".pdf"), true);
});

test("editorial presentation controls normalize with backward-compatible defaults", () => {
  const image = createEditorialBlock("image");
  const table = createEditorialBlock("table");
  const cta = createEditorialBlock("cta");
  assert.deepEqual(
    { align: image.align, position: image.position },
    { align: "left", position: "center" },
  );
  assert.deepEqual(
    { align: table.align, density: table.density },
    { align: "left", density: "comfortable" },
  );
  assert.deepEqual(
    { align: cta.align, width: cta.width },
    { align: "left", width: "auto" },
  );

  const parsed = parseEditorialDocument(JSON.stringify({
    version: 1,
    blocks: [
      { id: "copy", type: "richText", content: "Narasi", align: "center" },
      { id: "rule", type: "divider", style: "dashed", spacing: "compact" },
    ],
  }));
  assert.equal(parsed.blocks[0].align, "center");
  assert.deepEqual(
    { style: parsed.blocks[1].style, spacing: parsed.blocks[1].spacing },
    { style: "dashed", spacing: "compact" },
  );
});

test("editorial action, link, and callout controls stay bounded and survive normalization", () => {
  const document = parseEditorialDocument(JSON.stringify({
    version: 1,
    presentation: {
      objectives: { layout: "stacked", tone: "violet", density: "compact" },
      practical: { tone: "blue", density: "compact", checklistStyle: "list" },
    },
    blocks: [
      { id: "cta", type: "cta", label: "Mulai", url: "/modules/2", tone: "violet", size: "lg", radius: "pill", icon: "check", target: "new", width: "full" },
      { id: "link", type: "link", label: "Panduan", url: "https://example.com/guide", variant: "inline", tone: "violet", icon: "arrowRight", width: "wide", target: "same" },
      { id: "highlight", type: "callout", title: "Target", content: "Amati perubahan.", tone: "blue", variant: "solid", icon: "target", density: "compact", width: "wide" },
    ],
  }));

  assert.deepEqual(document.presentation, {
    objectives: { layout: "stacked", tone: "violet", density: "compact" },
    practical: { tone: "blue", density: "compact", checklistStyle: "list" },
  });
  assert.deepEqual(
    { tone: document.blocks[0].tone, size: document.blocks[0].size, radius: document.blocks[0].radius, icon: document.blocks[0].icon, target: document.blocks[0].target, width: document.blocks[0].width },
    { tone: "violet", size: "lg", radius: "pill", icon: "check", target: "new", width: "full" },
  );
  assert.deepEqual(
    { variant: document.blocks[1].variant, tone: document.blocks[1].tone, icon: document.blocks[1].icon, width: document.blocks[1].width, target: document.blocks[1].target },
    { variant: "inline", tone: "violet", icon: "arrowRight", width: "wide", target: "same" },
  );
  assert.deepEqual(
    { tone: document.blocks[2].tone, variant: document.blocks[2].variant, icon: document.blocks[2].icon, density: document.blocks[2].density, width: document.blocks[2].width },
    { tone: "blue", variant: "solid", icon: "target", density: "compact", width: "wide" },
  );

  const legacy = parseEditorialDocument(JSON.stringify({ version: 1, blocks: [{ id: "old", type: "cta", label: "Lanjut", url: "/modules/2" }] }));
  assert.equal(legacy.blocks[0].target, "auto");
  assert.equal(legacy.blocks[0].tone, "green");
  assert.equal(legacy.blocks[0].icon, "arrowRight");
});

test("PPTX compatibility flattens PowerPoint SVG blip relationships without touching ordinary media", () => {
  const svgBlip = '<a:blip cstate="print"><a:extLst><a:ext><asvg:svgBlip r:embed="rId6"/></a:ext></a:extLst></a:blip>';
  assert.equal(normaliseSvgBlipMarkup(svgBlip), '<a:blip cstate="print" r:embed="rId6"/>');

  const pngBlip = '<a:blip r:embed="rId3"/>';
  assert.equal(normaliseSvgBlipMarkup(pngBlip), pngBlip);
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

test("rich-text image nodes stay safe and preserve learner-ready markdown attributes", () => {
  const clean = sanitizeRichTextDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Sebelum" },
        ],
      },
      {
        type: "image",
        attrs: {
          src: "/uploads/diagram.webp",
          alt: "Diagram alur",
          title: "Aman",
          onerror: "alert(1)",
        },
      },
      {
        type: "image",
        attrs: { src: "javascript:alert(1)", alt: "Tidak aman" },
      },
    ],
  });

  assert.equal(clean.content.length, 2);
  assert.deepEqual(clean.content[1], {
    type: "image",
    attrs: { src: "/uploads/diagram.webp", alt: "Diagram alur", title: "Aman" },
  });
});

test("rich-text image layout metadata round-trips with bounded size and alignment", () => {
  const title = encodeRichTextImageTitle({ width: 640, height: 480, align: "center" });
  assert.match(title, /^aapm-image:v1;/);
  assert.deepEqual(parseRichTextImageTitle(title), {
    width: 640,
    height: 480,
    align: "center",
    title: null,
  });

  const unsafe = parseRichTextImageTitle("aapm-image:v1;w=999999&h=1&a=sideways");
  assert.deepEqual(unsafe, {
    width: 2400,
    height: 32,
    align: "left",
    title: null,
  });

  const legacyTitle = parseRichTextImageTitle("Diagram farm");
  assert.deepEqual(legacyTitle, { width: null, height: null, align: "left", title: "Diagram farm" });

  const safeDocument = sanitizeRichTextDocument({
    type: "doc",
    content: [{
      type: "image",
      attrs: { src: "/uploads/lesson.webp", width: 480, height: 320, align: "right" },
    }],
  });
  assert.deepEqual(safeDocument.content[0].attrs, {
    src: "/uploads/lesson.webp",
    alt: "",
    title: null,
    width: 480,
    height: 320,
    align: "right",
  });

  const enriched = enrichRichTextMarkdownImages(
    "Sebelum\n\n![Diagram](/uploads/lesson.webp)\n\nSesudah",
    { type: "doc", content: [{ type: "image", attrs: { src: "/uploads/lesson.webp", width: 480, align: "right" } }] },
  );
  assert.equal(enriched, "Sebelum\n\n![Diagram](/uploads/lesson.webp \"aapm-image:v1;w=480&a=right\")\n\nSesudah");
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

test("conversation archive state stays account-history friendly across page updates", () => {
  const original = {
    pages: [{
      items: [
        { id: 1, title: "Aktif", archivedAt: null },
        { id: 2, title: "Arsip", archivedAt: "2026-09-09 10:00:00" },
      ],
      total: 2,
      activeTotal: 1,
      archivedTotal: 1,
    }],
  };

  assert.equal(isConversationArchived(original.pages[0].items[0]), false);
  assert.equal(isConversationArchived(original.pages[0].items[1]), true);

  const archived = upsertConversationInPages(original, {
    id: "1",
    title: "Aktif",
    archivedAt: "2026-09-10 08:00:00",
  });
  assert.equal(archived.pages[0].activeTotal, 0);
  assert.equal(archived.pages[0].archivedTotal, 2);

  const restored = upsertConversationInPages(archived, {
    id: 2,
    title: "Arsip",
    archivedAt: null,
  });
  assert.equal(restored.pages[0].activeTotal, 1);
  assert.equal(restored.pages[0].archivedTotal, 1);

  const removed = removeConversationFromPages(restored, "1");
  assert.equal(removed.pages[0].total, 1);
  assert.equal(removed.pages[0].archivedTotal, 0);
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

test("PWA metadata uses the canonical app icon and leaves API responses uncached", () => {
  const manifest = JSON.parse(readWorkspaceFile("../public/manifest.json"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.icons?.[0]?.src, "/brand/aapm/pwa-main.svg");
  assert.equal(manifest.icons?.[0]?.purpose, "any maskable");

  const serviceWorker = readWorkspaceFile("../public/sw.js");
  assert.match(serviceWorker, /request\.method !== "GET"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("admin APPI rewrite remains preview-first and requires explicit confirmation", () => {
  const editor = readWorkspaceFile("../src/pages/admin/AdminModuleEditor.jsx");
  assert.match(editor, /Rewrite isi/);
  assert.match(editor, /Pratinjau rewrite copywriting/);
  assert.match(editor, /Ganti isi modul dengan rewrite APPI/);
  assert.match(editor, /onConfirm=\{applyRewrite\}/);
});

test("mobile shells keep APPI, dashboard cards, uploads, and session recovery bounded", () => {
  const aiPage = readWorkspaceFile("../src/pages/AiAssistant.jsx");
  const floatingAi = readWorkspaceFile("../src/components/ai/FloatingAiAssistant.jsx");
  const historyControls = readWorkspaceFile("../src/components/ai/AiHistoryControls.jsx");
  const chatProvider = readWorkspaceFile("../src/components/ai/AiChatProvider.jsx");
  const aiComposer = readWorkspaceFile("../src/components/ai/AiComposer.jsx");
  const dashboard = readWorkspaceFile("../src/components/academy/DashboardComponents.jsx");
  const editorial = readWorkspaceFile("../src/components/admin/EditorialComposer.jsx");
  const auth = readWorkspaceFile("../src/lib/AuthContext.jsx");
  const client = readWorkspaceFile("../src/api/nativeClient.js");
  const sidebarProfile = readWorkspaceFile("../src/components/layout/SidebarUserCard.jsx");
  const moduleEditor = readWorkspaceFile("../src/pages/admin/AdminModuleEditor.jsx");
  const lessonWorkspace = readWorkspaceFile("../src/components/academy/LessonWorkspace.jsx");
  const learnerContent = readWorkspaceFile("../src/components/academy/EditorialContent.jsx");
  const richEditor = readWorkspaceFile("../src/components/admin/RichTextEditor.jsx");
  const iconBridge = readWorkspaceFile("../src/components/icons/AapmIcon.jsx");
  const styles = readWorkspaceFile("../src/index.css");

  assert.match(aiPage, /aapm-ai-workspace--full-mobile/);
  assert.match(aiPage, /AiHistoryBulkBar/);
  assert.match(floatingAi, /AiHistoryBulkBar/);
  assert.match(historyControls, /Beri nama singkat agar mudah ditemukan/);
  assert.match(historyControls, /Pulihkan dari arsip/);
  assert.match(chatProvider, /bulkArchiveConversations/);
  assert.match(chatProvider, /bulkDeleteConversations/);
  assert.doesNotMatch(aiPage, /100dvh-8\.6rem/);
  assert.match(aiComposer, /Menyiapkan foto/);
  assert.match(dashboard, /aapm-dashboard-welcome__stats/);
  assert.match(styles, /\.aapm-dashboard-kpi[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /--aapm-shell-border-alpha: 0\.46/);
  assert.match(styles, /\.aapm-ai-frame[\s\S]*box-shadow: var\(--aapm-shell-shadow, none\)/);
  assert.match(styles, /\.aapm-ai-conversation-sidebar,[\s\S]*background-image: none/);
  assert.match(styles, /\.aapm-ai-card--interactive:hover[\s\S]*box-shadow: none/);
  assert.match(sidebarProfile, /aapm-sidebar-profile-row/);
  assert.doesNotMatch(sidebarProfile, /aapm-sidebar-user-card/);
  assert.match(moduleEditor, /aapm-editor-point-row grid/);
  assert.match(moduleEditor, /aapm-editor-point-action/);
  assert.match(lessonWorkspace, /aapm-lesson-insight-item grid/);
  assert.match(lessonWorkspace, /aapm-lesson-insight-index/);
  assert.match(richEditor, /aapm-rich-editor__toolbar-group/);
  assert.match(richEditor, /label="Format karakter"/);
  assert.match(richEditor, /name="editorLink"/);
  assert.match(richEditor, /setSelectedImageFit/);
  assert.match(richEditor, /syncSelectedImageSizeToDom/);
  assert.match(richEditor, /const BLOCK_STYLE_OPTIONS/);
  assert.match(richEditor, /active=\{blockStyle === value\}/);
  assert.match(richEditor, /wrapper\.style\.width = width \? `\$\{width\}px` : ""/);
  assert.match(richEditor, /ResizeObserver/);
  assert.match(richEditor, /paddingLeft/);
  assert.match(richEditor, /aria-label="Snap posisi gambar"/);
  assert.match(richEditor, /onValueCommit=\{\(\[value\]\) => setSelectedImageWidthPercent\(value\)\}/);
  assert.doesNotMatch(richEditor, /textLabel=/);
  assert.match(iconBridge, /editorUnlink: "solar:link-broken-minimalistic-linear"/);
  assert.match(iconBridge, /editorUndo: "solar:undo-left-round-linear"/);
  assert.doesNotMatch(iconBridge, /"solar:undo-left-round-linear": "refresh"/);
  assert.doesNotMatch(iconBridge, /"solar:undo-right-round-linear": "refresh"/);
  assert.match(iconBridge, /imageAlignCenter: "solar:align-horizontal-center-linear"/);
  assert.match(iconBridge, /imageFit: "solar:maximize-square-minimalistic-linear"/);
  assert.match(styles, /\.aapm-rich-editor__toolbar-separator/);
  assert.match(styles, /\.aapm-rich-editor__toolbar-button\[aria-pressed="true"\]/);
  assert.match(styles, /\[data-resize-container\]:has\(img\[data-image-align="center"\]\)/);
  assert.doesNotMatch(learnerContent, /rounded-xl border border-border object-contain/);
  assert.match(styles, /\.aapm-ai-workspace__main,[\s\S]*min-height: 0/);
  assert.match(styles, /\.aapm-sidebar-profile-row \{[\s\S]*background: transparent/);
  assert.doesNotMatch(editorial, /File presentasi baru akan menggantikan/);
  assert.match(editorial, /Siap mengganti sumber slide/);
  assert.match(editorial, /aria-busy=\{uploadState\.status === "loading"\}/);
  assert.match(client, /aapm:session-expired/);
  assert.match(auth, /Sesi Anda berakhir/);
});

test("editorial document players keep a shared reading-stage contract", () => {
  const pptx = readWorkspaceFile("../src/components/academy/PptxCarousel.jsx");
  const presentation = readWorkspaceFile("../src/components/academy/EditorialPresentation.jsx");
  const styles = readWorkspaceFile("../src/index.css");

  assert.match(pptx, /aapm-presentation-shell/);
  assert.match(pptx, /onProgress:/);
  assert.match(pptx, /setReloadToken/);
  assert.match(pptx, /Buka slide \$\{index \+ 1\}/);
  assert.match(presentation, /function PdfViewer/);
  assert.match(presentation, /aapm-pdf-viewport/);
  assert.match(presentation, /Buka tab baru/);
  assert.match(styles, /\.aapm-presentation-shell/);
  assert.match(styles, /\.aapm-pptx-viewport/);
  assert.match(styles, /\.aapm-pdf-frame/);
});
