// Layout rules behind the module editor and the curriculum action bar on tablets and phones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mediaBlock = (css, query) => {
  const start = css.indexOf(`@media ${query}`);
  assert.ok(start >= 0, query);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && --depth === 0) return css.slice(open, index);
  }
  throw new Error(`unterminated ${query}`);
};

test("stacked editor rows keep their content height, so the inspector never covers the canvas", () => {
  const stacked = mediaBlock(read("src/design-system/styles/academy-app.css"), "(max-width: 1199px)");
  assert.match(stacked, /\.aapm-editor-workspace \{[^}]*grid-auto-rows: max-content/);
});

test("the editor header gives its actions their own width instead of letting them cover the mode tabs", () => {
  const editor = read("src/pages/admin/AdminModuleEditor.jsx");
  assert.match(editor, /<div className="row gap-3 justify-end" style=\{\{ flex: "none" \}\}>/);
});

test("always-visible block toolbars sit in the flow and stay above the block's hit area", () => {
  const touch = mediaBlock(read("src/styles/features/editor-blocks.css"), "(hover: none), (pointer: coarse), (max-width: 1199px)");
  assert.match(touch, /\.aapm-block__bar \{[^}]*position: relative[^}]*top: 0[^}]*right: 0/);
});

test("a lesson whose video was retired does not call its instructor notes a video", () => {
  const lesson = read("src/pages/ModuleDetail.jsx");
  assert.match(lesson, /const lessonVideoIsPresent = \[module\?\.videoUrl, module\?\.videoEmbedUrl, module\?\.video\]\.some\(hasText\);/);
  assert.match(lesson, /lessonVideoIsPresent \? "Video materi" : "Catatan instruktur"/);
  assert.match(lesson, /<LessonSection id="video" title=\{videoSectionTitle\}/);
});

test("the curriculum action bar shows one set of actions below the desktop width", () => {
  const compact = mediaBlock(read("src/styles/features/curriculum.css"), "(max-width: 859px)");
  assert.match(compact, /\.aapm-curriculum-actionbar__desktop \{ display: none; \}/);
  assert.match(compact, /\.aapm-curriculum-actionbar \.row\.grow \{ display: none; \}/);
  // The .row utility has the same specificity and would keep the desktop group visible.
  assert.doesNotMatch(read("src/components/admin/CurriculumDraftFeedback.jsx"), /className="[^"]*\brow\b[^"]*aapm-curriculum-actionbar__desktop/);
});
