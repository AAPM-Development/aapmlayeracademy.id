import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = spawnSync("php", [join(repo, "tests", "fixtures", "q06", "companion.php")], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr || run.stdout);
const out = JSON.parse(run.stdout);

test("an order suggestion keeps only known, unique ids and is dropped when unusable", () => {
  assert.deepEqual(out.orderKnown[0].payload.moduleIds, ["c", "a", "b"]);
  assert.deepEqual(out.orderUnknown, []);
});

test("chapter module ideas are deduplicated, bounded to five and need a title", () => {
  const modules = out.chapter[0].payload.modules;
  assert.deepEqual(modules.map((item) => item.title), ["Satu", "Dua", "Tiga", "Empat", "Lima"]);
  assert.equal(out.chapter[0].payload.levelName, "Air Minum");
  assert.deepEqual(out.chapterEmpty, []);
});

test("review findings are trimmed plain sentences without repeats", () => {
  assert.deepEqual(out.review[0].payload.issues, ["Perbaiki tujuan", "5"]);
  assert.deepEqual(out.reviewEmpty, []);
});

test("unknown suggestion kinds are ignored and at most five are returned", () => {
  assert.deepEqual(out.unknownKind, []);
  assert.equal(out.maxFive, 5);
});

test("cutting text never splits a multibyte character", () => {
  assert.equal(out.cutValid, true);
  assert.equal(out.cutLength, 50);
});
