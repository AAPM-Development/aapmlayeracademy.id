import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleQuizNavigation } from '../src/lib/quizNavigation.js';

test('module quiz navigation reports incomplete progress without treating an empty quiz as complete', () => {
  assert.deepEqual(moduleQuizNavigation([]), {
    total: 0,
    checkedCount: 0,
    firstUnansweredIndex: -1,
    allChecked: false,
    isLast: false,
    nextIndex: null,
  });
  assert.deepEqual(moduleQuizNavigation([{ checked: true }, { checked: false }], 0), {
    total: 2,
    checkedCount: 1,
    firstUnansweredIndex: 1,
    allChecked: false,
    isLast: false,
    nextIndex: 1,
  });
});

test('a completed last question sends the learner to the first unanswered question before results', () => {
  const state = moduleQuizNavigation([{ checked: true }, { checked: false }, { checked: true }], 2);
  assert.equal(state.checkedCount, 2);
  assert.equal(state.firstUnansweredIndex, 1);
  assert.equal(state.isLast, true);
  assert.equal(state.allChecked, false);
  assert.equal(state.nextIndex, 1);
});

test('results become available only after every question has been checked', () => {
  const state = moduleQuizNavigation([{ checked: true }, { checked: true }], 1);
  assert.equal(state.checkedCount, 2);
  assert.equal(state.firstUnansweredIndex, -1);
  assert.equal(state.allChecked, true);
  assert.equal(state.nextIndex, null);
});
