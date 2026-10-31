// Layout rules behind the module editor and the curriculum action bar on tablets and phones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tableCellExit, tableCellTarget } from "../src/lib/tableCellNavigation.js";

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

test("a block editor bounds its column, so a wide table scrolls inside its own wrap", () => {
  const blocks = read("src/styles/features/editor-blocks.css");
  // An implicit grid track grows to the table's min-content and carries the whole editor past the card.
  assert.match(blocks, /\.aapm-block__editor \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(read("src/design-system/styles/academy.css"), /\.table-wrap \{ overflow-x: auto; \}/);
  assert.match(read("src/design-system/components/data.jsx"), /<div className=\{cn\("table-wrap", wrapClassName\)\}/);
});

test("the table block edits like a spreadsheet: ruled cells take typing and the active cell is outlined", () => {
  const blocks = read("src/styles/features/editor-blocks.css");
  const composer = read("src/components/admin/EditorialComposer.jsx");
  assert.match(composer, /<Table ref=\{tableRef\} wrapClassName="aapm-editor-table"/);
  // Input and Textarea render .input and .textarea; the older .aapm-input selectors match nothing here.
  assert.match(read("src/design-system/components/forms.jsx"), /<input ref=\{ref\} type=\{type\} className=\{cn\("input", className\)\}/);
  assert.match(read("src/design-system/components/forms.jsx"), /<textarea ref=\{ref\} className=\{cn\("textarea", className\)\}/);
  assert.match(blocks, /\.aapm-editor-table \.table tr > :is\(th, td\) \{[^}]*padding: 0/);
  assert.match(blocks, /\.aapm-editor-table \.input,\n\.aapm-editor-table \.textarea \{[^}]*border: 0[^}]*border-radius: 0/);
  // The resting box goes, so focus has to draw the cell being typed in.
  assert.match(blocks, /\.aapm-editor-table \.input:focus,\n\.aapm-editor-table \.textarea:focus \{[^}]*outline: 2px solid var\(--aapm-semantic-primary\)[^}]*outline-offset: -2px/);
});

test("arrow keys walk the table grid, with the header as row 0, and stop at its edges", () => {
  const grid = { rows: 3, columns: 4 };
  assert.deepEqual(tableCellTarget({ ...grid, key: "ArrowRight", row: 1, column: 1 }), { row: 1, column: 2 });
  assert.deepEqual(tableCellTarget({ ...grid, key: "ArrowLeft", row: 1, column: 1 }), { row: 1, column: 0 });
  assert.deepEqual(tableCellTarget({ ...grid, key: "ArrowUp", row: 1, column: 1 }), { row: 0, column: 1 });
  assert.deepEqual(tableCellTarget({ ...grid, key: "ArrowDown", row: 0, column: 3 }), { row: 1, column: 3 });
  assert.equal(tableCellTarget({ ...grid, key: "ArrowLeft", row: 1, column: 0 }), null);
  assert.equal(tableCellTarget({ ...grid, key: "ArrowRight", row: 1, column: 3 }), null);
  assert.equal(tableCellTarget({ ...grid, key: "ArrowUp", row: 0, column: 1 }), null);
  assert.equal(tableCellTarget({ ...grid, key: "ArrowDown", row: 2, column: 1 }), null);
  assert.equal(tableCellTarget({ ...grid, key: "Enter", row: 1, column: 1 }), null);
});

test("sideways arrows edit the text until the caret reaches its edge", () => {
  const text = { length: 5, multiline: true };
  assert.equal(tableCellExit({ ...text, key: "ArrowLeft", start: 2, end: 2 }), "stay");
  assert.equal(tableCellExit({ ...text, key: "ArrowRight", start: 2, end: 2 }), "stay");
  assert.equal(tableCellExit({ ...text, key: "ArrowLeft", start: 0, end: 0 }), "leave");
  assert.equal(tableCellExit({ ...text, key: "ArrowRight", start: 5, end: 5 }), "leave");
});

test("a selection stays in its cell, so the arrow collapses it as usual", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    assert.equal(tableCellExit({ key, start: 0, end: 5, length: 5, multiline: true }), "stay");
  }
});

test("vertical arrows leave a one-line field at once and let a wrapped cell move its caret first", () => {
  assert.equal(tableCellExit({ key: "ArrowDown", start: 2, end: 2, length: 5, multiline: false }), "leave");
  assert.equal(tableCellExit({ key: "ArrowUp", start: 2, end: 2, length: 5, multiline: false }), "leave");
  assert.equal(tableCellExit({ key: "ArrowDown", start: 0, end: 0, length: 0, multiline: true }), "leave");
  assert.equal(tableCellExit({ key: "ArrowUp", start: 0, end: 0, length: 5, multiline: true }), "leave");
  assert.equal(tableCellExit({ key: "ArrowDown", start: 5, end: 5, length: 5, multiline: true }), "leave");
  // Soft wraps are invisible in the value, so only the browser knows whether a line lies beyond.
  assert.equal(tableCellExit({ key: "ArrowDown", start: 2, end: 2, length: 5, multiline: true }), "wait");
  assert.equal(tableCellExit({ key: "ArrowUp", start: 2, end: 2, length: 5, multiline: true }), "wait");
});

test("the table editor wires arrow keys to its fields and reveals a column it adds", () => {
  const composer = read("src/components/admin/EditorialComposer.jsx");
  assert.match(composer, /<Input id=\{`\$\{block\.id\}-column-\$\{index\}`\}.*?onKeyDown=\{\(event\) => moveByArrow\(event, 0, index\)\}/);
  assert.match(composer, /<Textarea id=\{`\$\{block\.id\}-cell-\$\{rowIndex\}-\$\{columnIndex\}`\}.*?onKeyDown=\{\(event\) => moveByArrow\(event, rowIndex \+ 1, columnIndex\)\}/);
  // An IME uses the arrows to pick its candidate, and Shift+arrow extends a selection.
  assert.match(composer, /event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.nativeEvent\.isComposing/);
  assert.match(composer, /wrap\?\.scrollTo\(\{ left: wrap\.scrollWidth, behavior: reducedMotion \? "auto" : "smooth" \}\)/);
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
