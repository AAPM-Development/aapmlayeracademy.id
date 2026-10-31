import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function viewportFixture() {
  const handlers = new Map();
  const styles = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => styles.set(key, value), removeProperty: (key) => styles.delete(key) } };
  const viewport = { height: 800, offsetTop: 0, scale: 1, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  const window = { innerHeight: 800, innerWidth: 375, visualViewport: viewport, getComputedStyle: (element) => element.computed ?? { position: 'fixed', top: '388px' } };
  const document = { documentElement: root, activeElement: null, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  let cleanup;
  const source = readFileSync(new URL('../src/lib/useVisibleViewport.js', import.meta.url), 'utf8').replace(/import .*?;\r?\n/, '').replace('export default ', '') + '\nuseVisibleViewport();';
  runInNewContext(source, { window, document, useEffect: (fn) => { cleanup = fn(); }, requestAnimationFrame: (fn) => { fn(); return 0; }, cancelAnimationFrame: () => {} });
  return { root, styles, viewport, window, document, handlers, cleanup };
}
test('keyboard fits visual viewport even when the layout viewport remains tall', () => {
  const state = viewportFixture();
  state.document.activeElement = { matches: () => true };
  state.viewport.height = 480;
  state.handlers.get('resize')();
  assert.equal(state.root.dataset.keyboard, 'open');
  assert.equal(state.styles.get('--aapm-visible-height'), '480px');
  assert.equal(state.styles.get('--aapm-visible-bottom'), '320px');
  state.viewport.height = 800;
  state.handlers.get('resize')();
  assert.equal(state.root.dataset.keyboard, 'closed');
  state.cleanup();
  assert.equal(state.styles.size, 0);
});
test('resizes-content keyboards are detected and pinch zoom is not treated as a keyboard', () => {
  const state = viewportFixture();
  state.document.activeElement = { matches: () => true };
  state.window.innerHeight = state.viewport.height = 480;
  state.handlers.get('resize')();
  assert.equal(state.root.dataset.keyboard, 'open');
  state.viewport.scale = 1.5;
  state.handlers.get('resize')();
  assert.equal(state.root.dataset.keyboard, 'closed');
});

test('a keyboard moves the active editor field above draft actions using only the inner scrollport', () => {
  const state = viewportFixture();
  let scrollTop = 0;
  const panel = {
    scrollHeight: 1600, clientHeight: 420,
    getBoundingClientRect: () => ({ top: 60, bottom: 480 }),
    scrollBy: ({ top, behavior }) => { assert.equal(behavior, 'instant'); scrollTop += top; },
  };
  state.document.activeElement = {
    matches: () => true, closest: () => panel,
    getBoundingClientRect: () => ({ top: 650 - scrollTop, bottom: 746 - scrollTop, height: 96 }),
  };
  state.document.querySelector = (selector) => selector.includes('actionbar') ? { getBoundingClientRect: () => ({ top: 388, bottom: 480 }) } : null;
  state.viewport.height = 480;
  state.handlers.get('resize')();
  assert.equal(scrollTop, 358);
  state.handlers.get('resize')();
  assert.equal(scrollTop, 358, 'a field already clear of the toolbar is not scrolled again');
});

test('an editor field taller than the visible area aligns its top rather than losing its beginning', () => {
  const state = viewportFixture();
  let shift = 0;
  const panel = {
    scrollHeight: 1600, clientHeight: 420,
    getBoundingClientRect: () => ({ top: 60, bottom: 480 }),
    scrollBy: ({ top }) => { shift += top; },
  };
  state.document.activeElement = {
    matches: () => true, closest: () => panel,
    getBoundingClientRect: () => ({ top: 500 - shift, bottom: 1100 - shift, height: 600 }),
  };
  state.document.querySelector = () => null;
  state.viewport.height = 480;
  state.handlers.get('resize')();
  assert.equal(shift, 440);
});

test('the active field clears the available APPI launcher only when their horizontal bounds overlap', () => {
  const state = viewportFixture();
  let shift = 0;
  let launcherLeft = 370;
  const panel = {
    scrollHeight: 1600, clientHeight: 420,
    getBoundingClientRect: () => ({ top: 60, bottom: 480 }),
    scrollBy: ({ top }) => { shift += top; },
  };
  state.document.activeElement = {
    matches: () => true, closest: () => panel,
    getBoundingClientRect: () => ({ left: 37, right: 353, top: 292 - shift, bottom: 388 - shift, height: 96 }),
  };
  state.document.querySelector = (selector) => ({ getBoundingClientRect: () => selector.includes('actionbar')
    ? { top: 388, bottom: 480 }
    : { left: launcherLeft, right: launcherLeft + 52, top: 324, bottom: 376, width: 52 } });
  state.viewport.height = 480;
  state.handlers.get('resize')();
  assert.equal(shift, 0, 'a launcher outside the field width does not consume reading space');
  launcherLeft = 326;
  state.handlers.get('aapm:footer-resize')();
  assert.equal(shift, 64);
  state.handlers.get('resize')();
  assert.equal(shift, 64, 'the field stays clear without repeated scrolling');
});

// Rendered ancestors, nearest first, so a selector for a class no shell renders finds nothing.
function fieldInside(chain, top = 650) {
  const nodes = chain.map(({ name, scrolls = true, fixed = false }) => ({
    name, shift: 0, fixed,
    scrollHeight: scrolls ? 1600 : 420, clientHeight: 420,
    getBoundingClientRect: () => ({ top: 60, bottom: 800 }),
    scrollBy({ top: by }) { this.shift += by; },
  }));
  const closestFrom = (start) => (selector) => {
    const wanted = selector.split(',').map((part) => part.trim().slice(1));
    return nodes.slice(start).find((node) => wanted.includes(node.name)) ?? null;
  };
  nodes.forEach((node, index) => { node.closest = closestFrom(index); node.parentElement = nodes[index + 1] ?? null; });
  const moved = () => nodes.reduce((sum, node) => sum + node.shift, 0);
  return {
    nodes,
    field: {
      matches: () => true, closest: closestFrom(0),
      getBoundingClientRect: () => ({ top: top - moved(), bottom: top + 96 - moved(), height: 96 }),
    },
  };
}
const openKeyboard = (state, field) => {
  state.document.activeElement = field;
  state.document.querySelector = () => null;
  state.viewport.height = 480;
  state.handlers.get('resize')();
};

const tabletBar = (computed, bounds) => ({ computed, getBoundingClientRect: () => bounds });
const openOnTablet = (state, field, bar) => {
  state.window.innerWidth = 900;
  state.document.activeElement = field;
  state.document.querySelector = (selector) => selector.includes('actionbar') ? bar : null;
  state.viewport.height = 635;
  state.handlers.get('resize')();
};
const stuckUnderHeader = { position: 'sticky', top: '12px' };

test('a bar stuck under the header pushes a field below it instead of up behind it', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'main-scroll' }], 60);
  openOnTablet(state, field, tabletBar(stuckUnderHeader, { top: 72, bottom: 270 }));
  assert.equal(nodes[0].shift, -210);
  state.handlers.get('resize')();
  assert.equal(nodes[0].shift, -210, 'a field already clear of the bar is not scrolled again');
});

test('a field between a stuck bar and the keyboard stays where it is', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'main-scroll' }], 300);
  openOnTablet(state, field, tabletBar(stuckUnderHeader, { top: 72, bottom: 270 }));
  assert.equal(nodes[0].shift, 0);
});

test('a field past the keyboard scrolls to the visible edge, not to the top of a stuck bar', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'main-scroll' }], 892);
  openOnTablet(state, field, tabletBar(stuckUnderHeader, { top: 72, bottom: 270 }));
  assert.equal(nodes[0].shift, 353);
});

test('a sticky bar with no top offset still rests on the keyboard', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'aapm-editor-scroll' }], 500);
  openOnTablet(state, field, tabletBar({ position: 'sticky', top: 'auto' }, { top: 555, bottom: 635 }));
  assert.equal(nodes[0].shift, 41);
});

test('the keyboard scrolls the panel each screen really renders', () => {
  const shell = readFileSync(new URL('../src/design-system/patterns/AppShell.jsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/pages/admin/AdminModuleEditor.jsx', import.meta.url), 'utf8');
  assert.match(shell, /className="main-scroll"/);
  assert.match(editor, /aapm-editor-form aapm-editor-workspace/);
  assert.match(editor, /className="aapm-editor-scroll/);
  for (const name of ['main-scroll', 'aapm-editor-workspace', 'aapm-editor-scroll']) {
    const state = viewportFixture();
    const { nodes, field } = fieldInside([{ name }]);
    openKeyboard(state, field);
    assert.equal(nodes[0].shift, 266, `${name} moves the field above the keyboard`);
  }
});

test('an open drawer scrolls itself and leaves the canvas behind it still', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'aapm-editor-inspector' }, { name: 'aapm-editor-workspace' }]);
  openKeyboard(state, field);
  assert.equal(nodes[0].shift, 266);
  assert.equal(nodes[1].shift, 0);
});

test('a panel with nothing to scroll hands over to the panel that holds it', () => {
  const state = viewportFixture();
  const { nodes, field } = fieldInside([{ name: 'aapm-editor-inspector', scrolls: false }, { name: 'aapm-editor-workspace' }]);
  openKeyboard(state, field);
  assert.equal(nodes[0].shift, 0);
  assert.equal(nodes[1].shift, 266);
});

test('a field outside every scroll panel is left where the browser put it', () => {
  const state = viewportFixture();
  const { field } = fieldInside([{ name: 'aapm-ai-floating-panel' }]);
  assert.doesNotThrow(() => openKeyboard(state, field));
  assert.equal(state.root.dataset.keyboard, 'open');
});
