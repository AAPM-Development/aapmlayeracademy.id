import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function fixture(standalone = false) {
  const listeners = new Map();
  const state = [];
  let index = 0;
  let cleanup;
  const window = {
    navigator: { standalone },
    matchMedia: () => ({ matches: standalone, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const source = readFileSync(new URL('../src/lib/usePwaInstall.js', import.meta.url), 'utf8')
    .replace(/import .*?;\r?\n/, '').replaceAll('export ', '').replace('const PwaInstallContext', 'var PwaInstallContext') + '\nresult = usePwaInstallState();';
  const context = {
    window, createContext: () => null, useContext: () => null,
    useEffect: fn => { cleanup = fn(); }, useCallback: fn => fn,
    useState: initial => { const slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { state[slot] = value; }]; },
  };
  function render() { index = 0; runInNewContext(source, context); return context.result; }
  return { render, listeners, cleanup: () => cleanup() };
}

test('install invitation uses a captured browser event and waits for actual installation', async () => {
  const f = fixture();
  assert.equal(f.render().canInstall, false);
  let prompted = 0;
  let prevented = false;
  f.listeners.get('beforeinstallprompt')({ preventDefault() { prevented = true; }, prompt: async () => { prompted++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  const ready = f.render();
  assert.equal(prevented, true);
  assert.equal(ready.canInstall, true);
  await ready.install();
  assert.equal(prompted, 1);
  assert.equal(f.render().canInstall, false);
  assert.equal(f.render().isInstalled, false);
  f.listeners.get('appinstalled')();
  assert.equal(f.render().isInstalled, true);
  f.cleanup();
  assert.equal(f.listeners.size, 0);
});

test('standalone launch suppresses the install invitation', () => {
  const f = fixture(true);
  assert.equal(f.render().isInstalled, true);
  assert.equal(f.render().canInstall, false);
});
