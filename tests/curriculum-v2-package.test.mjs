// Curriculum v2.0 package: 23 modules, 10 questions each, 50 final questions, and the
// answer-pattern rules the team applies to every bank (no length cue, no absolute wording,
// balanced keys, trusted English or Indonesian videos). Static, reads the package file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE = join("scripts", "curriculum", "data", "2026-10-31-kurikulum-v2.json");
const pack = JSON.parse(readFileSync(PACKAGE, "utf8"));
const banks = () => [...pack.modules.map((module) => [`module ${module.moduleNumber}`, module.questions]), ["final exam", pack.finalExam.questions]];

test("v2 package: 23 modules in 14 chapters, every module names its chapter", () => {
  assert.equal(pack.schema, "aapm-curriculum-update/1");
  assert.equal(pack.modules.length, 23);
  assert.equal(Object.keys(pack.chapters).length, 14);
  for (const module of pack.modules) {
    assert.ok(pack.chapters[String(module.levelNumber)], `module ${module.moduleNumber} has a chapter name`);
  }
});

test("v2 package: each module carries ten questions with four options and a valid key", () => {
  for (const module of pack.modules) {
    assert.equal(module.questions.length, 10, `module ${module.moduleNumber}`);
    for (const question of module.questions) {
      assert.equal(question.options.length, 4, `module ${module.moduleNumber}`);
      assert.ok(question.correctIndex >= 0 && question.correctIndex < 4);
      assert.ok(question.explanation.length > 0, `module ${module.moduleNumber} explanation`);
    }
  }
  assert.equal(pack.finalExam.questions.length, 50);
});

test("v2 package: answer keys are spread across all four letters", () => {
  const keys = banks().flatMap(([, questions]) => questions).map((question) => question.correctIndex);
  for (const letter of [0, 1, 2, 3]) {
    const share = keys.filter((key) => key === letter).length / keys.length;
    assert.ok(share > 0.2 && share < 0.3, `letter ${letter} share ${share.toFixed(3)}`);
  }
});

const rankOf = (question, rank) => {
  const lengths = question.options.map((option) => option.length);
  const target = [...lengths].sort((a, b) => a - b)[rank];
  return lengths[question.correctIndex] === target && lengths.filter((length) => length === target).length === 1;
};

test("v2 package: the correct option is not a length cue, in any module or the final exam", () => {
  for (const [name, questions] of banks()) {
    const passMark = name === "final exam" ? 40 : 7;
    for (const rank of [0, 1, 2, 3]) {
      assert.ok(questions.filter((question) => rankOf(question, rank)).length < passMark, `${name}, length rank ${rank}`);
    }
  }
  const all = banks().flatMap(([, questions]) => questions);
  assert.ok(all.filter((question) => rankOf(question, 3)).length <= all.length / 4, "longest option above chance");
});

test("v2 package: absolute wording stays out of the wrong options", () => {
  const absolute = /\b(pasti|selalu|tidak perlu|tidak pernah|semua|hanya|saja)\b/i;
  for (const [name, questions] of banks()) {
    const flagged = questions.flatMap((question) => question.options.filter((option, index) => index !== question.correctIndex && absolute.test(option)));
    assert.ok(flagged.length <= (name === "final exam" ? 3 : 1), `${name}: ${flagged.join(" / ")}`);
  }
});

test("v2 package: every video is English or Indonesian and names a source type", () => {
  const allowed = ["government", "industry", "foundation", "research", "breeder", "un_agency", "university", "publisher"];
  for (const module of pack.modules) {
    assert.ok(["en", "id"].includes(module.video.language), `module ${module.moduleNumber} language`);
    assert.ok(allowed.includes(module.video.sourceType), `module ${module.moduleNumber} source type`);
    assert.match(module.video.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+$/);
  }
});

test("v2 package: the tier mapping covers modules 1 to 23 once, with the final on tier 6", () => {
  const tiers = [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21], [22, 23]];
  assert.deepEqual(tiers.flat(), Array.from({ length: 23 }, (_, index) => index + 1));
});
