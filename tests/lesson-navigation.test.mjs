import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonNavigation } from '../src/lib/lessonNavigation.js';

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
