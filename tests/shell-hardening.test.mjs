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
  assert.match(app(), /@media \(max-width: 859px\) and \(min-height: 701px\) \{\n\s*\.app\[data-tone="calm"\]:has\(\.aapm-curriculum-actionbar\) \.launcher \{/);
});

test("the action bar follows the page on a short screen instead of taking the reading room", () => {
  assert.match(curriculum(), /@media \(max-width: 859px\) and \(max-height: 700px\) \{\n\s*\.aapm-curriculum-actionbar \{ position: static; \}/);
});

test("the app opens in light mode until the learner chooses dark", () => {
  for (const file of ["index.html", "src/lib/useThemeMode.js"]) {
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("prefers-color-scheme"), `${file} follows the system appearance`);
    assert.ok(source.includes("aapm-theme"), `${file} still reads the saved choice`);
  }
});

const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("a route change names the tab, announces the page, and moves focus to the new content", () => {
  const announcer = read("src/components/RouteAnnouncer.jsx");
  assert.match(read("src/App.jsx"), /<ScrollToTop \/>\s*<RouteAnnouncer \/>/);
  assert.match(announcer, /document\.title = /);
  assert.match(announcer, /role="status"/);
  assert.match(announcer, /aria-atomic="true"/);
  assert.match(announcer, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(!read("src/components/AuthLayout.jsx").includes("document.title"), "one source names the tab");
});

test("closing an overlay opened from app state returns focus to what opened it", () => {
  const overlays = read("src/design-system/components/overlays.jsx");
  assert.match(overlays, /function useFocusReturn\(/);
  assert.equal(overlays.match(/useFocusReturn\(props\)/g)?.length, 3, "dialog, sheet, and alert dialog");
  assert.doesNotMatch(read("src/components/search/SearchPalette.jsx"), /\sautoFocus[\s/>]/, "a React autoFocus would hide the opener");
});

test("the YouTube frame leaves the tab order, because the player's own controls drive it", () => {
  assert.match(read("src/lib/lessonVideo.js"), /iframe\.setAttribute\("tabindex", "-1"\)/);
});

test("sign-in pages do not open the phone keyboard on arrival", () => {
  for (const page of ["Login", "Register", "ForgotPassword", "ResetPassword"]) {
    assert.match(read(`src/pages/${page}.jsx`), /autoFocus=\{hasFinePointer\(\)\}/, page);
  }
});

test("digits on a solid hue reach AA in the light theme", () => {
  const css = canvas();
  const token = (name) => new RegExp(`--${name}: (#[0-9a-f]{3,6})`, "i").exec(css)?.[1];
  const onGold = token("on-gold");
  assert.ok(contrast(token("teal"), "#ffffff") >= 4.5, "teal");
  assert.ok(contrast(token("gold"), onGold) >= 4.5, "gold");
  assert.match(css, /\[data-hue\] \{ --on-medal: var\(--on-hue\); \}/);
  assert.match(css, /\[data-hue="gold"\]\s*\{[^}]*--on-medal: var\(--on-gold\)/);
  assert.match(css, /\[data-hue="amber"\]\s*\{[^}]*--on-medal: #241900/);
  assert.ok(contrast(token("amber"), "#241900") >= 4.5, "amber");
});

test("the chapter banner chip stays readable in the dark theme", () => {
  assert.match(app(), /:is\(\.dark \.aapm, \.aapm\[data-theme="dark"\]\) \.unit-banner \.chip \{ background: var\(--surface\); \}/);
});

test("the active tab keeps its whole indicator inside the sideways scroller", () => {
  assert.match(app(), /\.tabs \{ overflow-y: hidden; border-bottom: 0; box-shadow: inset 0 -2px 0 var\(--border\); \}/);
  assert.match(app(), /\.tab \{ margin-bottom: 0; \}/);
});

test("the logo reserves its box before the image loads", () => {
  const source = read("src/design-system/canvas.jsx");
  assert.match(source, /long: \{ \.\.\.brandAssets\.aapm\.logo, width: 369, height: 44 \}/);
  assert.equal(source.match(/width=\{source\.width\} height=\{source\.height\}/g)?.length, 2);
});

test("focus stays visible on tab panels, the editor's title fields, and outline links", () => {
  assert.ok(!app().includes(".tabs-content:focus-visible { outline: none; }"));
  assert.match(read("src/styles/features/editor-blocks.css"), /\.aapm-editor-doc-summary:focus-visible \{ outline: 2px solid var\(--focus\); outline-offset: -2px; \}/);
  assert.match(app(), /\.outline-item:focus-visible \{ outline-offset: -2px; \}/);
});

test("narrow screens keep content inside its card", () => {
  assert.ok(!read("src/components/academy/CourseElements.jsx").includes("minWidth: 220"), "the continue card's fixed minimum");
  assert.match(read("src/pages/admin/AdminCourseDetail.jsx"), /"0 1 200px"/);
  assert.match(read("src/pages/VerifyCertificate.jsx"), /className="topbar verify-topbar"/);
  assert.match(app(), /\.toolbar > \.seg \{ max-width: 100%; min-width: 0; overflow-x: auto; \}/);
  assert.match(app(), /\.t-break, \.li-title \{ overflow-wrap: anywhere; \}/);
});

test("the send button stays in the composer at every width", () => {
  assert.match(app(), /\.composer-foot \.send \{ margin-left: auto; \}/);
  assert.match(app(), /@media \(max-width: 360px\) \{\n\s*\.composer-foot \{ gap: 2px; \}\n\s*\.composer-foot \.composer-sep \{ display: none; \}/);
});

test("the admin search gives way before the breadcrumb does", () => {
  assert.ok(!read("src/components/admin/AdminQuickSearch.jsx").includes("width={300}"));
  assert.match(app(), /\.topbar:has\(> \.crumbs\) > \.ml-auto \{ flex: 0 8 auto; min-width: 0; \}/);
  assert.match(app(), /\.topbar > \.ml-auto > \.cmd \{ flex: 1 1 300px; width: 300px; min-width: 120px; \}/);
});

test("four and six stat cards fold into even rows instead of leaving an orphan", () => {
  assert.match(app(), /@media \(min-width: 640px\) and \(max-width: 1240px\) \{\n\s*\.grid-sm:has\(> :nth-child\(4\):last-child\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(app(), /\.grid-xs:has\(> :nth-child\(6\):last-child\) \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
});

test("list rows in the palette and APPI panel keep the focus ring", () => {
  const css = app();
  assert.ok(!css.includes(".palette-row:focus-visible { background: var(--surface-subtle); outline: none; }"));
  assert.ok(!css.includes(".appi-quick:focus-visible { background: var(--surface-subtle); outline: none; }"));
  assert.match(css, /\.appi-quick:focus-visible, \.palette-row:focus-visible \{ outline-offset: -2px; \}/);
});

test("a modal scrolls inside itself, so its close button, title, and actions stay in view", () => {
  const overlays = read("src/design-system/components/overlays.jsx");
  assert.equal(overlays.match(/<div className="dialog-scroll">\{children\}<\/div>/g)?.length, 2, "dialog and alert dialog");
  assert.match(app(), /\.dialog-scroll > \.dialog-head \{ position: sticky;/);
  assert.match(app(), /\.dialog-scroll > \.dialog-foot \{ position: sticky;/);
  assert.match(app(), /\.dialog-close \{ position: absolute;[^}]*z-index: var\(--z-decor\); \}/);
});

test("a list sheet is a centred modal above phone width, and every sheet animates out", () => {
  assert.match(app(), /@media \(min-width: 641px\) \{\n\s*\.sheet\.sheet-live\[data-side="bottom"\] \{ top: 50%;/);
  assert.match(app(), /\.sheet-live\[data-state="closed"\] \{ animation: sheet-out-right/);
});

test("touch fields stay at 16px and full target height, so iOS does not zoom the page", () => {
  assert.match(app(), /\.input > input, \.input > textarea, input\.input, \.textarea, \.select, \.search > input, \.composer textarea, \.appi-panel \.composer textarea \{ font-size: var\(--fs-lg\); \}/);
  assert.match(app(), /\.menu-item \{ min-height: var\(--h-lg\); \}/);
});

test("opening an overlay on touch does not raise the keyboard", () => {
  const overlays = read("src/design-system/components/overlays.jsx");
  assert.match(overlays, /if \(event\.defaultPrevented \|\| hasFinePointer\(\)\) return;/);
});

test("a toast holds while it is read, and clears the launcher and the focus action bar", () => {
  const toast = read("src/design-system/components/toast.jsx");
  assert.match(toast, /onMouseEnter=\{\(\) => hold\(item\.id\)\}/);
  assert.match(toast, /onFocus=\{\(\) => hold\(item\.id\)\}/);
  assert.match(app(), /:root:has\(\.launcher-fixed\) \.toast-region \{ bottom:/);
  assert.match(app(), /:root\[data-shell="focus"\] \.toast-region \{ bottom: calc\(var\(--aapm-focus-footer-height/);
});

test("APPI sits at the top centre of the sign-in video", () => {
  assert.match(read("src/components/AuthLayout.jsx"), /<div className="appi-stage auth-brand-appi">/);
  assert.match(app(), /\.auth-brand-appi \{ position: relative; z-index: 1; align-self: center; margin-bottom: auto; \}/);
});

test("the APPI room is one rail and one reading column, with the composer as the raised object", () => {
  const shell = read("src/components/layout/AcademyShell.jsx");
  assert.match(shell, /const collapsed = collapsedPreference \|\| isAiWorkspace;/);
  assert.match(app(), /\.appi-transcript-col:has\(> \.appi-welcome\) \{ min-height: 100%; justify-content: center; \}/);
  assert.match(app(), /\.aapm-ai-workspace__main \.composer \{[^}]*box-shadow: var\(--shadow-card\)/);
  assert.match(read("src/pages/AiAssistant.jsx"), /className="anim-rise appi-suggest"/);
});

test("no rule paints a background on a mask icon, which would colour the glyph itself", () => {
  const css = `${canvas()}\n${app()}`.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  const painted = rules.filter((rule) => {
    const [selectors, body] = rule.split("{");
    const icon = selectors.split(",").some((selector) => /\.ic\s*$/.test(selector.trim()));
    return icon && !/^\s*\.ic\s*$/.test(selectors) && /(^|[;\s])background(-color)?\s*:/.test(body);
  });
  assert.deepEqual(painted.map((rule) => rule.trim().slice(0, 80)), []);
});

test("the certificate export draws the numeral from an image, the same pixels as the preview", () => {
  const document = read("src/components/certificate/CertificateDocument.jsx");
  assert.match(document, /async function tierNumeral\(tierNumber, color\)/);
  assert.equal(document.match(/numeralUrl=\{numeralUrl\}/g)?.length, 2, "preview and export");
  assert.match(read("public/brand/aapm/logo_long.svg"), /width="738" height="88"/);
});
