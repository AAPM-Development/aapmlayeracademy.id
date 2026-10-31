// Curriculum v2 release path, in operator order: import with module creation and chapter
// moves, policy preparation, activation, and the move of existing learners. Real CLIs
// under disposable SQLite.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SQLITE, cleanEnv, cleanup, repo, rows, setup, signIn, passModule, withSite } from "./helpers/site.mjs";

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
