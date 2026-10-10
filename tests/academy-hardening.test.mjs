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
import { correctRun, formatDuration } from "../src/lib/learningPath.js";
import {
  EDITORIAL_PRESENTATION_MAX_BYTES,
  EDITORIAL_PRESENTATION_MAX_SLIDES,
} from "../src/lib/editorialLimits.js";
import { normaliseSvgBlipMarkup } from "../src/lib/pptxCompatibility.js";
import { nativeApi } from "../src/api/nativeClient.js";
import { reconcileSavedModule } from "../src/lib/editorSaveState.js";
import { filterCurriculum, nextChapterNumber } from "../src/lib/curriculumState.js";
import {
  EDITORIAL_PRESENTATION_ACCEPT,
  getEditorialPresentationFormatFromName,
  getEditorialPresentationFormatFromUrl,
} from "../src/lib/editorialPresentation.js";
import {
  aiEditorialMaterialPrompt,
  aiEditorialMaterialSource,
  applyAiEditorialMaterial,
  normaliseAiEditorialMaterial,
} from "../src/lib/aiEditorialRewrite.js";

const readWorkspaceFile = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
// The stylesheet entry only imports layers; assertions read the bundle in order.
const readStyles = () => {
  const entry = readWorkspaceFile("../src/index.css");
  return [...entry.matchAll(/@import "\.\/([^"]+)";/g)]
    .map(([, path]) => readWorkspaceFile(`../src/${path}`))
    .join("\n");
};

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

test("quiz readouts stay honest", () => {
  assert.equal(correctRun([true, true, false, true, true, true], 5), 3);
  assert.equal(correctRun([true, undefined, true], 2), 1);
  assert.equal(correctRun([true, true, true], 1), 2);
  assert.equal(correctRun([], 3), 0);

  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65_400), "1:05");
  assert.equal(formatDuration(-5), "0:00");
});

test("Duolingo-style learner flow keeps its accessibility and motion contracts", () => {
  const quiz = readWorkspaceFile("../src/pages/Quiz.jsx");
  const assessment = readWorkspaceFile("../src/components/academy/AssessmentComponents.jsx");
  const course = readWorkspaceFile("../src/components/academy/CourseElements.jsx");
  const celebrate = readWorkspaceFile("../src/lib/celebrate.js");
  const theme = readWorkspaceFile("../src/lib/useThemeMode.js");
  const styles = readStyles();

  // The verdict is announced through a live region that exists before the
  // check, and the action bar takes the verdict tone.
  assert.match(quiz, /className="aapm-visually-hidden" role="status"/);
  assert.match(quiz, /footerTone=\{isChecked/);
  // Enter never double-fires on a focused button or link.
  assert.match(quiz, /target\?\.closest\("button, a"\) && !target\.closest\("\.aapm-choice"\)/);
  assert.match(assessment, /aria-keyshortcuts/);
  // One h1 per result screen: the assessment bar holds it.
  assert.match(assessment, /<h2 className="aapm-result__title">/);
  // Path nodes are links with a full name; the current one is the step.
  assert.match(course, /aria-label=\{`Modul \$\{module\.moduleNumber\}: \$\{module\.title\}/);
  assert.match(course, /aria-current=\{state === "current" \? "step" : undefined\}/);
  // Celebration and theme switching respect motion preferences.
  assert.match(celebrate, /prefers-reduced-motion: reduce/);
  assert.match(theme, /aapm-theme-switching/);
  assert.match(styles, /\.aapm-theme-switching \*/);
  // The learning track sits on the page grid: a level band over a rail of
  // modules that fills behind finished ones; card height follows the modules.
  assert.match(styles, /\.aapm-track__unit \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) minmax\(9rem, 13rem\)/);
  assert.match(styles, /\.aapm-track__item\[data-state="completed"\] \+ \.aapm-track__item::before \{ background: var\(--aapm-semantic-primary\); \}/);
  assert.match(styles, /--aapm-primitive-motion-ease-spring/);
});

test("scrollable lesson reserves its footer for quiz or module navigation", () => {
  const lesson = readWorkspaceFile("../src/pages/ModuleDetail.jsx");
  const quiz = readWorkspaceFile("../src/pages/Quiz.jsx");
  const shell = readWorkspaceFile("../src/design-system/patterns/AppShell.jsx");

  assert.doesNotMatch(lesson, /const primaryAction = sectionNavigation\.next/);
  assert.doesNotMatch(lesson, /ModuleFlow|sectionSheet|sectionNavigation|Bagian sebelumnya/);
  const footer = lesson.slice(lesson.indexOf("footer={("), lesson.indexOf('<div className="aapm-lesson-layout">'));
  assert.doesNotMatch(footer, /markComplete|jumpToSection/);
  assert.match(footer, /flow\.completed \|\| flow\.hasQuiz/);
  assert.match(lesson, /label="Keluar ke jalur belajar" variant="danger" icon="close"/);
  assert.match(lesson, /flow\.activeAttempt \? "Lanjutkan kuis"/);
  assert.match(lesson, /Link to=\{`\/modules\/\$\{next\.moduleNumber\}`\}/);
  assert.match(quiz, /outlineLabel="Navigasi soal"/);
  assert.match(shell, /aria-label=\{outlineLabel\}/);
});

test("progress writes are retired; academic results and study time are server-recorded", () => {
  const api = readWorkspaceFile("../public/api/index.php");
  const assessment = readWorkspaceFile("../public/api/assessment.php");
  const lesson = readWorkspaceFile("../src/pages/ModuleDetail.jsx");
  const quiz = readWorkspaceFile("../src/pages/Quiz.jsx");
  const finalExam = readWorkspaceFile("../src/pages/FinalExam.jsx");
  const hooks = readWorkspaceFile("../src/lib/useCourseData.js");
  const client = readWorkspaceFile("../src/api/nativeClient.js");
  const studyTime = readWorkspaceFile("../src/lib/useStudyTime.js");

  // Client writes to /progress are refused and name the academic fields; nothing is stored.
  assert.match(api, /aapm_reject_progress_write\(request_json\(\)\)/);
  assert.match(assessment, /'academic_field_forbidden'/);
  assert.match(assessment, /'progress_write_retired'/);
  // Study time arrives as capped increments with their own keys; long sessions are split on the page.
  assert.match(assessment, /AAPM_STUDY_INCREMENT_MAX_MINUTES/);
  assert.match(lesson, /useStudyTimeIncrement\(\)/);
  assert.match(lesson, /Math\.min\(15, remaining\)/);
  assert.match(lesson, /practice\.mutateAsync\(\{ moduleNumber: number, attested: done \}\)/);
  assert.match(lesson, /acknowledge\.mutateAsync\(number\)/);
  // The quiz and the final exam take their state from the server attempt and never score on the client.
  assert.match(quiz, /useAnswerAssessment\(\)/);
  assert.match(finalExam, /useFinalEligibility\(\)/);
  for (const page of [quiz, finalExam]) {
    assert.doesNotMatch(page, /(?:item|question)\??\.correctIndex/);
    assert.doesNotMatch(page, /timeSpentDeltaMinutes|quizScore: /);
  }
  assert.doesNotMatch(finalExam, /useIssueCertificate|certificates\.create/);
  assert.doesNotMatch(hooks, /useSaveProgress|useIssueCertificate/);
  assert.doesNotMatch(client, /userProgress\.upsert|create: \(data\) => request\("\/certificates"/);
  // Idle tabs do not count: only visible time with recent activity.
  assert.match(studyTime, /document\.visibilityState === "visible" && Date\.now\(\) - lastActivity < IDLE_AFTER_MS/);
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
  assert.match(editor, /Rewrite isi \+ materi/);
  assert.match(editor, /materialBlocks/);
  assert.match(editor, /fieldPresence/);
  assert.match(editor, /Pratinjau rewrite copywriting/);
  assert.match(editor, /Ganti isi modul dengan rewrite APPI/);
  assert.match(editor, /onConfirm=\{applyRewrite\}/);
  assert.match(editor, /Format dipertahankan/);
  const client = readWorkspaceFile("../src/api/nativeClient.js");
  const api = readWorkspaceFile("../public/api/index.php");
  const provider = readWorkspaceFile("../public/api/openrouter.php");
  assert.match(client, /rewriteEditorial/);
  assert.match(api, /admin\/ai\/rewrite-editorial/);
  assert.match(api, /require_admin\(\)/);
  assert.match(api, /ai_assistant_reply\(\$message, \[\], false, \[\], 6000, 24000\)/);
  assert.match(provider, /messageLimit = 3000/);
});

test("APPI editorial rewrite preserves Markdown media and non-text blocks", () => {
  const document = createEditorialDocument([
    { id: "heading", type: "heading", content: "Mengapa penting?", level: 2 },
    {
      id: "copy",
      type: "richText",
      content: "**Naskah lama**\n\n![Kandang](/uploads/kandang.webp \"aapm-image:v1;w=480;a=center\")\n\n[Dokumentasi](https://example.com/sop)",
    },
    { id: "image", type: "image", src: "/uploads/diagram.webp", alt: "Diagram", decorative: false },
  ]);
  const source = aiEditorialMaterialSource(document);
  const sourceRichText = source.find((block) => block.id === "copy");
  const prompt = aiEditorialMaterialPrompt(source);
  assert.match(prompt, /APPI_MEDIA_1/);
  assert.doesNotMatch(prompt, /kandang\.webp/);

  const rewritten = normaliseAiEditorialMaterial([
    {
      id: "copy",
      type: "richText",
      content: `**Naskah baru**\n\n${sourceRichText.content}`,
    },
  ], source);
  assert.equal(rewritten.length, 1);
  assert.match(rewritten[0].content, /\*\*Naskah baru\*\*/);
  assert.match(rewritten[0].content, /!\[Kandang\]\(\/uploads\/kandang\.webp/);
  assert.match(rewritten[0].content, /aapm-image:v1;w=480;a=center/);
  assert.match(rewritten[0].content, /\[Dokumentasi\]\(https:\/\/example\.com\/sop\)/);

  const unsafeRewrite = normaliseAiEditorialMaterial([
    {
      id: "copy",
      type: "richText",
      content: `${sourceRichText.content}\n\n![AI asset](https://example.com/new.webp)`,
    },
  ], source);
  assert.equal(unsafeRewrite[0].content, sourceRichText.sourceContent);

  const applied = applyAiEditorialMaterial(document, "", rewritten);
  assert.equal(applied.editorialContent.blocks[0].content, "Mengapa penting?");
  assert.equal(applied.editorialContent.blocks[1].content, rewritten[0].content);
  assert.equal(applied.editorialContent.blocks[2].type, "image");
});

test("OpenRouter requests stay model-compatible and surface upstream diagnostics", () => {
  const provider = readWorkspaceFile("../public/api/openrouter.php");
  const registry = readWorkspaceFile("../public/api/aiProviders.php");

  // OpenRouter free models do not share one reasoning-effort contract. The
  // transport must not force effort=none and turn a healthy provider into an
  // opaque "Provider returned error" failure.
  assert.doesNotMatch(provider, /\$body\[['"]reasoning['"]\]/);
  assert.doesNotMatch(provider, /\$requestBody\[['"]reasoning['"]\]/);
  assert.match(registry, /error\['metadata'\]/);
  assert.match(registry, /Provider returned error/);
  assert.match(registry, /ai_registry_provider_error_retryable/);
  assert.match(registry, /usleep\(250000\)/);
});

test("mobile shells keep APPI, dashboard cards, uploads, and session recovery bounded", () => {
  const aiPage = readWorkspaceFile("../src/pages/AiAssistant.jsx");
  const academyShell = readWorkspaceFile("../src/components/layout/AcademyShell.jsx");
  const appiRoomStyles = readWorkspaceFile("../src/styles/features/appi-room.css");
  const floatingAi = readWorkspaceFile("../src/components/ai/FloatingAiAssistant.jsx");
  const historyControls = readWorkspaceFile("../src/components/ai/AiHistoryControls.jsx");
  const chatProvider = readWorkspaceFile("../src/components/ai/AiChatProvider.jsx");
  const aiComposer = readWorkspaceFile("../src/components/ai/AiComposer.jsx");
  const dashboard = readWorkspaceFile("../src/components/academy/DashboardComponents.jsx");
  const editorial = readWorkspaceFile("../src/components/admin/EditorialComposer.jsx");
  const auth = readWorkspaceFile("../src/lib/AuthContext.jsx");
  const client = readWorkspaceFile("../src/api/nativeClient.js");
  const shell = readWorkspaceFile("../src/design-system/patterns/AppShell.jsx");
  const moduleEditor = readWorkspaceFile("../src/pages/admin/AdminModuleEditor.jsx");
  const lessonWorkspace = readWorkspaceFile("../src/components/academy/LessonWorkspace.jsx");
  const learnerContent = readWorkspaceFile("../src/components/academy/EditorialContent.jsx");
  const richEditor = readWorkspaceFile("../src/components/admin/RichTextEditor.jsx");
  const uploadProgress = readWorkspaceFile("../src/components/admin/UploadProgress.jsx");
  const iconBridge = readWorkspaceFile("../src/design-system/icons/iconData.js");
  const styles = readStyles();

  // The route shell owns viewport height and bottom-nav clearance. Keeping
  // the old page-level mobile height would restore the outer scroll gap.
  assert.match(academyShell, /className=\{isAiWorkspace \? "aapm-app--chat" : undefined\}/);
  assert.doesNotMatch(aiPage, /aapm-ai-workspace--full-mobile/);
  assert.match(appiRoomStyles, /\.aapm-app--chat\s*\{\s*height: 100dvh;/);
  assert.match(appiRoomStyles, /\.aapm-app\.aapm-app--chat\[data-bottom-nav="true"\] \.aapm-app__main\s*\{[^}]*padding: 0;[^}]*overflow: hidden;/);
  assert.match(aiPage, /aapm-ai-transcript[^"\n]*overflow-x-hidden overflow-y-auto/);
  assert.match(aiPage, /AiHistoryBulkBar/);
  assert.match(floatingAi, /AiHistoryBulkBar/);
  assert.match(historyControls, /Beri nama singkat agar mudah ditemukan/);
  assert.match(historyControls, /Pulihkan dari arsip/);
  assert.match(chatProvider, /bulkArchiveConversations/);
  assert.match(chatProvider, /bulkDeleteConversations/);
  assert.doesNotMatch(aiPage, /100dvh-8\.6rem/);
  // Learner dashboard and shells use the AAPM design-system patterns.
  assert.match(dashboard, /aapm-hero/);
  assert.match(dashboard, /aapm-progress-tile/);
  assert.match(shell, /aapm-bottom-nav/);
  assert.match(shell, /function NavigationSheet/);
  assert.match(shell, /export const FocusShell/);
  assert.match(styles, /\.aapm-bottom-nav__item\[aria-current="page"\]/);
  assert.match(styles, /html\[data-shell="focus"\] \.aapm-ai-launcher/);
  assert.match(aiComposer, /Menyiapkan foto/);
  assert.match(styles, /--aapm-shell-border-alpha: 0\.46/);
  assert.match(styles, /\.aapm-ai-frame[\s\S]*box-shadow: var\(--aapm-shell-shadow, none\)/);
  assert.match(styles, /\.aapm-ai-conversation-sidebar,[\s\S]*background-image: none/);
  assert.match(styles, /\.aapm-ai-card--interactive:hover[\s\S]*box-shadow: none/);
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
  assert.doesNotMatch(editorial, /File presentasi baru akan menggantikan/);
  assert.match(editorial, /Siap mengganti sumber slide/);
  assert.match(editorial, /aria-busy=\{uploadState\.status === "loading"\}/);
  assert.match(editorial, /UploadProgress/);
  assert.match(editorial, /uploadControllerRef/);
  assert.match(editorial, /onProgress: \(\{ percent \}\)/);
  assert.match(client, /aapm:session-expired/);
  assert.match(client, /XMLHttpRequest/);
  assert.match(client, /xhr\.upload/);
  assert.match(client, /createAbortError/);
  assert.match(richEditor, /UploadProgress/);
  assert.match(richEditor, /imageUploadControllerRef/);
  assert.match(richEditor, /imageUploadControllerRef\.current\?\.abort/);
  assert.match(uploadProgress, /role="progressbar"/);
  assert.match(uploadProgress, /aria-valuenow/);
  assert.match(uploadProgress, /Batalkan/);
  assert.match(auth, /Sesi Anda berakhir/);
});

test("editorial document players keep a shared reading-stage contract", () => {
  const pptx = readWorkspaceFile("../src/components/academy/PptxCarousel.jsx");
  const presentation = readWorkspaceFile("../src/components/academy/EditorialPresentation.jsx");
  const styles = readStyles();

  assert.match(pptx, /aapm-presentation-shell/);
  assert.match(pptx, /onProgress:/);
  assert.match(pptx, /normaliseRoundedRectPath/);
  assert.match(pptx, /data-aapm-rounded-rect-normalized/);
  assert.match(pptx, /--pptx-slide-ratio/);
  assert.match(pptx, /setReloadToken/);
  assert.match(pptx, /Buka slide \$\{index \+ 1\}/);
  assert.match(pptx, /presentationLabels:\s*\{\s*exit: "Keluar dari layar penuh"/);
  assert.match(presentation, /function PdfViewer/);
  assert.match(presentation, /aapm-pdf-viewport/);
  assert.match(presentation, /Buka tab baru/);
  assert.match(styles, /\.aapm-presentation-shell/);
  assert.match(styles, /\.aapm-pptx-viewport/);
  assert.match(styles, /svg\.drawing[\s\S]*max-width: none/);
  assert.match(styles, /\.aapm-pdf-canvas/);
  assert.match(styles, /\.flyfish-pptx-presentation \.flyfish-pptx-presentation-exit/);
  assert.match(styles, /background: var\(--aapm-semantic-danger\) !important/);
  assert.match(styles, /color: #fff !important/);
  assert.match(styles, /width: 3rem !important/);
});

test("native cPanel APPI companion stays provider-backed in the module draft editor and preview-first", () => {
  const client = readWorkspaceFile("../src/api/nativeClient.js");
  const api = readWorkspaceFile("../public/api/index.php");
  const provider = readWorkspaceFile("../public/api/openrouter.php");
  const companion = readWorkspaceFile("../src/components/admin/AdminModuleCompanion.jsx");
  const moduleEditor = readWorkspaceFile("../src/pages/admin/AdminModuleEditor.jsx");
  const courseEditor = readWorkspaceFile("../src/pages/admin/AdminCourseDetail.jsx");

  assert.match(client, /moduleCompanion/);
  assert.match(api, /admin\/ai\/module-companion/);
  assert.match(api, /ai_admin_companion_reply/);
  assert.match(api, /require_admin\(\)/);
  assert.match(api, /require_csrf\(\)/);
  assert.match(provider, /ai_admin_companion_reply/);
  assert.match(provider, /Maksimal 5 saran/);
  assert.match(companion, /APPI companion/);
  assert.match(companion, /preview/);
  assert.match(companion, /ConfirmDialog/);
  assert.match(companion, /onApplyModule/);
  assert.match(companion, /onApplyOrder/);
  assert.match(moduleEditor, /AdminModuleCompanion/);
  assert.match(courseEditor, /APPI membantu isi draf melalui editor modul/);
  assert.doesNotMatch(courseEditor, /scope="course"|onApplyOrder|AdminModuleCompanion/);
});

test("PDF player has a recovery path when embedded cPanel rendering fails", () => {
  const viewer = readWorkspaceFile("../src/components/academy/EditorialPresentation.jsx");
  const styles = readStyles();
  const packageJson = readWorkspaceFile("../package.json");
  const htaccess = readWorkspaceFile("../public/.htaccess");
  assert.match(packageJson, /pdfjs-dist/);
  assert.match(viewer, /pdfjs\.getDocument/);
  assert.match(viewer, /pdfjsWorker/);
  assert.match(viewer, /canvasRef/);
  assert.match(viewer, /disableRange: true/);
  assert.match(viewer, /Buka PDF/);
  assert.match(viewer, /aapm-pdf-reader-controls/);
  assert.match(styles, /\.aapm-pdf-canvas/);
  assert.match(styles, /\.aapm-pdf-reader-controls/);
  assert.match(htaccess, /AddType application\/javascript \.mjs/);
  assert.match(htaccess, /AddType application\/pdf \.pdf/);
});

test("AAPM design tokens stay generated from the JSON authority", async () => {
  const { buildTokenCss } = await import("../scripts/build-aapm-tokens.mjs");
  const tokens = JSON.parse(readWorkspaceFile("../src/design-system/tokens/aapm-academy.tokens.json"));
  const generated = readWorkspaceFile("../src/design-system/aapm-tokens.css").replace(/\r\n/g, "\n");
  assert.equal(generated, buildTokenCss(tokens));
  assert.match(generated, /--aapm-semantic-primary: var\(--aapm-primitive-green\)/);
  const icons = readWorkspaceFile("../src/design-system/icons/iconData.js");
  assert.match(icons, /@iconify-icons\/solar\/home-angle-bold-duotone\.js/);
  assert.doesNotMatch(readWorkspaceFile("../package.json"), /@ten4seven\/ui/);
});

test("a module save preserves newer edits and adopts normalization only for unchanged fields", () => {
  const submitted = { title: "Before", summary: "old summary", levelNumber: "1", editorialContent: { blocks: [{ id: "a", text: "sent" }] } };
  const current = { ...submitted, title: "Typed while saving", editorialContent: { blocks: [{ id: "a", text: "newer" }] } };
  const saved = { ...submitted, title: "Before normalized", levelNumber: 1, summary: "normalized summary" };
  const result = reconcileSavedModule(submitted, current, saved);
  assert.equal(result.title, "Typed while saving");
  assert.deepEqual(result.editorialContent, current.editorialContent);
  assert.equal(result.levelNumber, 1);
  assert.equal(result.summary, "normalized summary");
  assert.equal(submitted.title, "Before");
  assert.deepEqual(reconcileSavedModule(submitted, submitted, saved), saved);
});

test("curriculum search includes chapter names and module numbers without changing their order", () => {
  const levels = [
    { levelNumber: 1, levelName: "Foundation", modules: [{ id: 1, moduleNumber: 7, title: "Biosecurity", category: "Hygiene" }, { id: 2, moduleNumber: 8, title: "Kandang" }] },
    { levelNumber: 20, levelName: "Review", modules: [{ id: 3, moduleNumber: 80, title: "Evaluasi" }] },
  ];
  assert.equal(filterCurriculum(levels, "   "), levels);
  assert.deepEqual(filterCurriculum(levels, "FOUNDATION")[0].modules.map(m => m.id), [1, 2]);
  assert.deepEqual(filterCurriculum(levels, "Chapter 20")[0].modules.map(m => m.id), [3]);
  assert.deepEqual(filterCurriculum(levels, "Modul 8")[0].modules.map(m => m.id), [2]);
  assert.deepEqual(filterCurriculum(levels, "hygiene")[0].modules.map(m => m.id), [1]);
  assert.deepEqual(filterCurriculum(levels, "missing"), []);
  assert.equal(levels[0].modules.length, 2);
  assert.equal(nextChapterNumber(levels), 2);
  assert.equal(nextChapterNumber(Array.from({ length: 20 }, (_, i) => ({ levelNumber: i + 1 }))), null);
  assert.equal(nextChapterNumber([]), 1);
});

test("APPI transport handles split UTF-8/CRLF and surfaces incomplete or failed streams", async (t) => {
  let body = "";
  let closeAtEnd = false;
  let cancelled = false;
  let requestSignal;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/auth/csrf")) return Response.json({ data: { csrfToken: "test-token" } });
    requestSignal = options.signal;
    return new Response(new ReadableStream({
      start(controller) {
        for (const byte of new TextEncoder().encode(body)) controller.enqueue(new Uint8Array([byte]));
        if (closeAtEnd) controller.close();
      },
      cancel() { cancelled = true; },
    }), { headers: { "Content-Type": "text/event-stream" } });
  });
  const run = (nextBody, onEvent = () => {}, signal) => {
    body = nextBody;
    closeAtEnd = !nextBody.includes("event: done") && !nextBody.includes("event: error") && !nextBody.includes("invalid-json");
    cancelled = false;
    return nativeApi.ai.stream({ message: "QA", onEvent, signal });
  };
  await t.test("split CRLF and multibyte text complete on done without waiting for EOF", async () => {
    const events = [];
    const controller = new AbortController();
    await run('event: delta\r\ndata: {"text":"Ayam 🐔"}\r\n\r\nevent: done\r\ndata: {"persisted":true}\r\n\r\n', event => events.push(event), controller.signal);
    assert.equal(events[0].data.text, "Ayam 🐔");
    assert.equal(events.at(-1).event, "done");
    assert.equal(requestSignal, controller.signal);
    assert.equal(cancelled, true);
  });
  await t.test("EOF before done is a recoverable interruption", async () => {
    await assert.rejects(run('event: delta\ndata: {"text":"partial"}\n\n'), { code: "stream_interrupted" });
  });
  await t.test("provider error events propagate their message", async () => {
    await assert.rejects(run('event: error\ndata: {"message":"Provider unavailable","code":"upstream_error"}\n\n'), { code: "upstream_error", message: "Provider unavailable" });
  });
  await t.test("invalid JSON is surfaced and callback failures are not swallowed", async () => {
    await assert.rejects(run('event: delta\ndata: invalid-json\n\n'), { code: "invalid_stream" });
    await assert.rejects(run('event: done\ndata: {}\n\n', () => { throw new Error("render failed"); }), { message: "render failed" });
  });
});
