import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonNavigation, scrollLessonSection } from '../src/lib/lessonNavigation.js';
import { getModuleState, getProgressSummary } from '../src/lib/academyData.js';

const sections = [{ id: 'content' }, { id: 'video' }, { id: 'objectives' }, { id: 'practical' }];
test('new lesson advances to the next reading section rather than skipping to practice', () => {
  assert.equal(lessonNavigation(sections, 'content').next.id, 'video');
  assert.equal(lessonNavigation(sections, 'content').previous, null);
});
test('rereading and returning through sections preserve their order', () => {
  assert.equal(lessonNavigation(sections, 'objectives').previous.id, 'video');
  assert.equal(lessonNavigation(sections, 'objectives').next.id, 'practical');
  assert.equal(lessonNavigation(sections, 'practical').atEnd, true);
});
test('lessons without optional sections can finish without nonexistent destinations', () => {
  assert.equal(lessonNavigation([{ id: 'content' }], 'content').next, null);
  assert.equal(lessonNavigation([{ id: 'content' }], 'stale-section').atEnd, true);
});

test('rereading scrolls only the lesson panel and refuses a target outside it', () => {
  const calls = [];
  const target = { getBoundingClientRect: () => ({ top: -480 }) };
  const panel = { scrollTop: 800, contains: (element) => element === target, getBoundingClientRect: () => ({ top: 60 }), scrollTo: (options) => calls.push(options) };
  scrollLessonSection(panel, target, 'auto');
  scrollLessonSection(panel, {});
  scrollLessonSection(null, target);
  assert.deepEqual(calls, [{ top: 260, behavior: 'auto' }]);
});

test('later published modules are available without counting navigation as completion', () => {
  const modules = [{ moduleNumber: 1 }, { moduleNumber: 2 }, { moduleNumber: 3 }];
  assert.equal(getModuleState(modules[0], modules), 'current');
  assert.equal(getModuleState(modules[2], modules), 'available');
  assert.equal(getProgressSummary(modules, []).completed, 0);
  assert.equal(getModuleState(modules[0], modules, new Set([1])), 'completed');
});
