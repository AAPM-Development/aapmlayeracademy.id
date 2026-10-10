import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function viewportFixture() {
  const handlers = new Map();
  const styles = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => styles.set(key, value), removeProperty: (key) => styles.delete(key) } };
  const viewport = { height: 800, offsetTop: 0, scale: 1, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  const window = { innerHeight: 800, innerWidth: 375, visualViewport: viewport };
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
  state.document.querySelector = () => ({ getBoundingClientRect: () => ({ top: 388, bottom: 480 }) });
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
