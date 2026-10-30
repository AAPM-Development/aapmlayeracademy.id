// Shell rules for every width and height: navigation stays reachable, bars keep their
// controls on screen, and phone chrome stays tappable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const app = () => read("src/design-system/styles/academy-app.css");
const canvas = () => read("src/design-system/styles/academy.css");
const curriculum = () => read("src/styles/features/curriculum.css");

test("the navigation sheet scrolls inside itself, so its last item is reachable on a short screen", () => {
  assert.match(app(), /\.aapm-nav-sheet \.side \{[^}]*flex: 1 1 auto[^}]*max-width: none[^}]*min-height: 0/);
  assert.match(app(), /\.aapm-nav-sheet \{[^}]*display: flex/);
});

test("the search gives way in a narrow topbar, so the account control stays on screen", () => {
  assert.match(app(), /\.topbar > \.cmd \{[^}]*flex: 0 1 440px[^}]*min-width: 0/);
  assert.match(app(), /\.topbar:has\(> \.cmd\) > \.ml-auto \{ flex: none; \}/);
});

test("a long account name cannot widen the topbar", () => {
  assert.match(app(), /\.topbar-account \.t-clamp-1 \{ max-width: 11rem; \}/);
});

test("a narrow topbar shows the avatar alone; the account menu carries the full name", () => {
  assert.match(app(), /\.topbar-account > :not\(\.avatar\) \{ display: none; \}/);
});

test("the module editor has one main landmark and a skip link", () => {
  const editor = read("src/pages/admin/AdminModuleEditor.jsx");
  assert.match(editor, /<a className="aapm-skip-link" href="#aapm-editor-main">Lewati ke konten<\/a>/);
  assert.match(editor, /<main id="aapm-editor-main" className="aapm-editor-stage" tabIndex=\{-1\} aria-label="Editor modul">/);
  assert.doesNotMatch(editor, /<div className="aapm-editor-stage">/);
});

test("phone chrome controls reach a 40px target", () => {
  const css = app();
  assert.match(css, /@media \(max-width: 860px\), \(pointer: coarse\) \{\n[^@]*\.m-top > a:first-child \{[^}]*height: var\(--h-md\)/);
  assert.match(css, /\.m-top \.xp \{ height: var\(--h-md\); \}/);
  assert.match(css, /\.focus-bar \.btn-sm, \.focus-foot \.btn-sm \{[^}]*height: var\(--h-md\)/);
});

test("a long unbroken title wraps instead of widening the page", () => {
  assert.match(app(), /:is\(h1, h2, h3, h4\), \.ph-title, \.ph-desc, \.sh-title \{ overflow-wrap: anywhere; \}/);
  assert.match(app(), /\.m-top > \.grow \{ min-width: 0; \}/);
});

test("email fields do not autocorrect, and loading copy uses a real ellipsis", () => {
  for (const page of ["src/pages/Login.jsx", "src/pages/Register.jsx"]) assert.match(read(page), /type="email"\n\s*autoComplete="email"\n\s*autoCapitalize="none"\n\s*spellCheck=\{false\}/);
  assert.doesNotMatch(read("src/components/academy/LearningStates.jsx"), /belajar\.\.\./);
});

test("breadcrumb links keep a 24px target", () => {
  assert.match(canvas(), /\.crumbs a \{[^}]*min-height: 24px/);
});

test("a collapsed sidebar does not scroll sideways", () => {
  assert.match(app(), /\.side\[data-collapsed="true"\] \.side-body \{[^}]*overflow-x: hidden/);
});

test("the APPI launcher rests above the curriculum action bar, not behind it", () => {
  assert.match(app(), /@media \(max-width: 859px\) and \(min-height: 501px\) \{\n\s*\.app\[data-tone="calm"\]:has\(\.aapm-curriculum-actionbar\) \.launcher \{/);
});

test("the action bar follows the page on a short screen instead of taking the reading room", () => {
  assert.match(curriculum(), /@media \(max-width: 859px\) and \(max-height: 500px\) \{\n\s*\.aapm-curriculum-actionbar \{ position: static; \}/);
});
