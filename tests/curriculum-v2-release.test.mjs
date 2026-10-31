// Curriculum v2 release path, in operator order: import with module creation and chapter
// moves, policy preparation, activation, and the move of existing learners. Real CLIs
// under disposable SQLite.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SQLITE, cleanEnv, cleanup, repo, rows, setup, signIn, passModule, sql, withSite } from "./helpers/site.mjs";

after(cleanup);

const PACKAGE = join("scripts", "curriculum", "data", "2026-10-31-kurikulum-v2.json");
const ADMIN = "pengelola@example.test";
const guards = ["--expect-environment=local", `--actor-email=${ADMIN}`];
const evidence = ["--operator=Operator Uji", "--evidence-ref=AUDIT-2026-10-31"];

const cli = (site, script, args) => spawnSync("php", [...SQLITE, join(repo, "scripts", "curriculum", script), ...args], {
  cwd: repo,
  encoding: "utf8",
  env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
});
const importer = (site, args) => cli(site, "import-curriculum-update.php", [`--file=${PACKAGE}`, ...guards, ...args]);
const jsonOut = (result) => JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
const ok = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);

test("without --create-missing a module outside the catalogue stops the import", async () => {
  const { site } = await setup("v2-blocked");
  const plan = jsonOut(importer(site, ["--dry-run"]));
  assert.deepEqual(plan.blocking, [23]);
  assert.equal(importer(site, ["--apply", ...evidence]).status, 4);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules")[0].n), 22, "nothing was written");
});

const holdNumber = (site) => sql(site, "INSERT INTO module_number_allocations (module_number, first_module_id, allocated_at) VALUES (23, 900, '2026-10-01 00:00:00')");

test("a number left by a deleted draft shows in the dry run and is released only on request", async () => {
  const { site } = await setup("v2-held");
  holdNumber(site);
  const plan = jsonOut(importer(site, ["--dry-run", "--create-missing"]));
  assert.deepEqual(plan.blocking, [23]);
  assert.equal(plan.modules.find((module) => module.moduleNumber === 23).status, "number_held");
  assert.equal(importer(site, ["--apply", "--create-missing", ...evidence]).status, 4);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules")[0].n), 22, "nothing was written");

  const release = ["--create-missing", "--release-unused-numbers"];
  assert.deepEqual(jsonOut(importer(site, ["--dry-run", ...release])).blocking, []);
  ok(importer(site, ["--apply", ...release, ...evidence]));
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules WHERE lifecycle_status = 'active'")[0].n), 23);
  const event = rows(site, "SELECT metadata_json FROM curriculum_publication_events WHERE event_type = 'module_number.released'");
  assert.equal(event.length, 1);
  assert.equal(JSON.parse(event[0].metadata_json).evidenceRef, "AUDIT-2026-10-31");
});

test("a held number with any record behind it stays held, even on request", async () => {
  const { site, learnerA } = await setup("v2-held-record");
  holdNumber(site);
  sql(site, `INSERT INTO assessment_attempts (public_id, user_id, assessment_type, module_number, policy_version, passing_grade, status, total_questions, started_at, expires_at, start_request_key, created_at, updated_at) VALUES ('old-23', ${learnerA}, 'module_quiz', 23, 'academy-v1', 70, 'superseded', 5, '2026-10-01 00:00:00', '2026-10-02 00:00:00', 'old-23-key', '2026-10-01 00:00:00', '2026-10-01 00:00:00')`);
  const release = ["--create-missing", "--release-unused-numbers"];
  const held = jsonOut(importer(site, ["--dry-run", ...release])).modules.find((module) => module.moduleNumber === 23);
  assert.equal(held.status, "number_held");
  assert.deepEqual(held.records, { assessment_attempts: 1 });
  assert.equal(importer(site, ["--apply", ...release, ...evidence]).status, 4);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_number_allocations WHERE module_number = 23")[0].n), 1);
});

test("the v2 release moves chapters, creates module 23, and sends every learner to the new policy", async () => {
  const { site, learnerA } = await setup("v2-release");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 1);
  });
  const attempts = Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ?", [learnerA])[0].n);
  assert.ok(attempts > 0);

  ok(importer(site, ["--apply", "--create-missing", ...evidence]));
  const modules = rows(site, "SELECT module_number, level_number, level_name, lifecycle_status FROM course_modules ORDER BY module_number");
  assert.equal(modules.length, 23);
  assert.ok(modules.every((module) => module.lifecycle_status === "active"));
  assert.equal(modules.find((module) => module.module_number === 5).level_number, 2, "Growing & Rearing moved into chapter 2");
  assert.equal(modules.find((module) => module.module_number === 23).level_number, 14);
  assert.equal(new Set(modules.map((module) => module.level_name)).size, 14);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 23")[0].n), 10);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 0")[0].n), 50);

  const replay = jsonOut(importer(site, ["--dry-run"]));
  assert.ok(replay.modules.every((module) => module.status === "unchanged"), "a replay changes nothing");

  assert.equal(cli(site, "move-learners-to-policy.php", ["--policy-version=academy-v2", ...guards, "--dry-run"]).status, 4, "the policy is not active yet");
  ok(cli(site, "prepare-policy-v2.php", [...guards, "--apply"]));
  ok(cli(site, "activate-policy.php", ["--policy-version=academy-v2", "--expect-environment=local", "--apply", ...evidence]));
  ok(cli(site, "move-learners-to-policy.php", ["--policy-version=academy-v2", ...guards, "--apply", ...evidence]));

  assert.equal(JSON.parse(rows(site, "SELECT required_modules_json FROM assessment_policies WHERE policy_version = 'academy-v2'")[0].required_modules_json).length, 23);
  const tiers = rows(site, "SELECT tier_number, required_modules_json, requires_final FROM certificate_tier_policies WHERE policy_version = 'academy-v2' ORDER BY tier_number");
  assert.deepEqual(tiers.map((tier) => JSON.parse(tier.required_modules_json)), [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21], [22, 23]]);
  assert.equal(tiers[5].requires_final, 1);

  assert.equal(rows(site, "SELECT policy_version FROM learner_curriculum_assignments WHERE user_id = ?", [learnerA])[0].policy_version, "academy-v2");
  assert.equal(Number(rows(site, "SELECT current_generation FROM learner_academic_state WHERE user_id = ?", [learnerA])[0].current_generation), 2, "old progress no longer counts");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ?", [learnerA])[0].n), attempts, "history is kept");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const profile = (await learner.get("/api/profile")).json.data.learning;
    assert.equal(profile.completedModules ?? profile.modulesCompleted ?? 0, 0);
  });
});
