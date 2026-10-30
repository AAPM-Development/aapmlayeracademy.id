// Operator curriculum import: plan-only dry run, refusal on unpublished editor work,
// publication through the draft/publish path, kept media blocks, idempotent replay,
// and environment/actor guards. Real CLI under disposable SQLite, or a task-owned
// MariaDB when AAPM_TEST_MYSQL_CONFIG is set.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SQLITE, cleanEnv, cleanup, repo, rows, setup, sql } from "./helpers/site.mjs";

after(cleanup);

const PACKAGE = join("scripts", "curriculum", "data", "2026-10-30-kurikulum-produksi.json");
const ADMIN = "pengelola@example.test";
const pack = JSON.parse(readFileSync(join(repo, PACKAGE), "utf8"));

function importer(site, args) {
  return spawnSync("php", [...SQLITE, join(repo, "scripts", "curriculum", "import-curriculum-update.php"), `--file=${PACKAGE}`, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
}

const count = (site, table) => Number(rows(site, `SELECT COUNT(*) AS n FROM ${table}`)[0].n);
const jsonOut = (result) => JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
const apply = ["--expect-environment=local", `--actor-email=${ADMIN}`, "--apply", "--operator=Operator Uji", "--evidence-ref=AUDIT-2026-10-30"];

test("package: every module has a full bank and answer keys are spread across all letters", () => {
  assert.equal(pack.modules.length, 22);
  for (const module of pack.modules) {
    assert.equal(module.questions.length, 5, `module ${module.moduleNumber}`);
    assert.equal(new Set(module.questions.map((question) => question.correctIndex)).size, 4, `module ${module.moduleNumber} keys`);
  }
  assert.equal(pack.finalExam.questions.length, 30);
  const keys = [...pack.modules.flatMap((module) => module.questions), ...pack.finalExam.questions].map((question) => question.correctIndex);
  for (const letter of [0, 1, 2, 3]) {
    assert.equal(keys.filter((key) => key === letter).length, keys.length / 4);
  }
});

test("package: always picking the longest option cannot pass a module quiz or the final exam", () => {
  const isUniqueLongest = (question) => {
    const lengths = question.options.map((option) => option.length);
    const longest = Math.max(...lengths);
    return lengths[question.correctIndex] === longest && lengths.filter((length) => length === longest).length === 1;
  };
  for (const module of pack.modules) {
    assert.ok(module.questions.filter(isUniqueLongest).length <= 2, `module ${module.moduleNumber}`);
  }
  assert.ok(pack.finalExam.questions.filter(isUniqueLongest).length <= 10, "final exam");
});

test("dry run reports the plan and writes nothing", async () => {
  const { site } = await setup("import-dry");
  const before = [count(site, "module_revisions"), count(site, "quiz_questions"), count(site, "curriculum_publication_events")];
  const result = importer(site, ["--expect-environment=local", `--actor-email=${ADMIN}`, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  const plan = jsonOut(result);
  assert.equal(plan.changed, false);
  assert.equal(plan.modules.length, 22);
  assert.ok(plan.modules.every((module) => module.status === "update"));
  assert.equal(plan.modules[2].questionCount.target, 5);
  assert.equal(plan.finalExam.status, "update");
  assert.deepEqual([count(site, "module_revisions"), count(site, "quiz_questions"), count(site, "curriculum_publication_events")], before);
  assert.equal(count(site, "module_drafts"), 0, "the plan never creates draft rows");
});

test("unpublished editor work stops the whole apply before any change", async () => {
  const { site } = await setup("import-pending");
  const moduleId = Number(rows(site, "SELECT id FROM course_modules WHERE module_number = 5")[0].id);
  const adminId = Number(rows(site, "SELECT id FROM users WHERE email = ?", [ADMIN])[0].id);
  const saved = spawnSync("php", [...SQLITE, join(repo, "tests", "fixtures", "q05", "save-draft.php"), String(moduleId), "1", String(adminId), "Judul draf editor"], {
    cwd: repo, encoding: "utf8", env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
  assert.equal(saved.status, 0, saved.stdout + saved.stderr);
  const revisions = count(site, "module_revisions");
  const titleBefore = rows(site, "SELECT title FROM course_modules WHERE module_number = 1")[0].title;

  const result = importer(site, apply);
  assert.equal(result.status, 4, result.stdout + result.stderr);
  assert.match(result.stderr, /draf yang tertunda/);
  assert.equal(count(site, "module_revisions"), revisions);
  assert.equal(rows(site, "SELECT title FROM course_modules WHERE module_number = 1")[0].title, titleBefore);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 1")[0].n), 1, "module 1 bank untouched");
});

test("apply publishes every module and the final bank, keeps media blocks, and replays as a no-op", async () => {
  const { site } = await setup("import-apply");
  const video = { id: "keep-video", type: "video", url: "https://www.youtube.com/watch?v=kvz8QQG_mXU", caption: "Video produksi", align: "left" };
  const legacyText = { id: "old-text", type: "richText", content: "Teks lama", align: "left" };
  sql(site, "UPDATE course_modules SET editorial_content = ? WHERE module_number = 1", [JSON.stringify({ version: 1, blocks: [legacyText, video] })]);
  const revisions = count(site, "module_revisions");

  const result = importer(site, apply);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const summary = jsonOut(result);
  assert.equal(summary.changed, true);
  assert.equal(summary.publishedModules.length, 22);
  assert.ok(summary.finalExamRevision >= 1);
  assert.equal(count(site, "module_revisions"), revisions + 22);

  for (const module of pack.modules) {
    const live = rows(site, "SELECT title, lifecycle_status FROM course_modules WHERE module_number = ?", [module.moduleNumber])[0];
    assert.equal(live.title, module.fields.title);
    assert.equal(live.lifecycle_status, "active");
    const questions = rows(site, "SELECT question, correct_index FROM quiz_questions WHERE module_number = ? ORDER BY id", [module.moduleNumber]);
    assert.deepEqual(questions.map((row) => [row.question, Number(row.correct_index)]), module.questions.map((question) => [question.question, question.correctIndex]));
  }
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 0")[0].n), 30);

  const editorial = JSON.parse(rows(site, "SELECT editorial_content FROM course_modules WHERE module_number = 1")[0].editorial_content);
  assert.equal(editorial.blocks[0].id, "keep-video", "existing video block kept first");
  assert.ok(!editorial.blocks.some((block) => block.id === "old-text"), "old text replaced by the package");
  assert.equal(editorial.blocks.length, 1 + pack.modules[0].editorialBlocks.length);

  const events = rows(site, "SELECT metadata_json FROM curriculum_publication_events WHERE event_type = 'draft.saved'").map((row) => JSON.parse(row.metadata_json));
  assert.equal(events.filter((meta) => meta.source === "curriculum-import" && meta.evidenceRef === "AUDIT-2026-10-30").length, 22);

  const replay = importer(site, apply);
  assert.equal(replay.status, 0, replay.stderr);
  const second = jsonOut(replay);
  assert.equal(second.changed, false);
  assert.ok(second.modules.every((module) => module.status === "unchanged"));
  assert.equal(second.finalExam.status, "unchanged");
  assert.equal(count(site, "module_revisions"), revisions + 22);
});

test("wrong environment, non-admin actor, and a missing evidence reference are refused", async () => {
  const { site } = await setup("import-guards");
  const wrongEnvironment = importer(site, ["--expect-environment=production", `--actor-email=${ADMIN}`, "--dry-run"]);
  assert.equal(wrongEnvironment.status, 3);
  const learner = importer(site, ["--expect-environment=local", "--actor-email=peserta-a@example.test", "--dry-run"]);
  assert.equal(learner.status, 3);
  const noEvidence = importer(site, ["--expect-environment=local", `--actor-email=${ADMIN}`, "--apply"]);
  assert.equal(noEvidence.status, 2);
  assert.equal(count(site, "module_drafts"), 0);
});
