// Synthetic demo learners: real CLI under disposable SQLite. They reach the hall of fame
// through the normal assessment functions, and removing them leaves no trace.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SQLITE, cleanEnv, cleanup, passModule, repo, rows, setup, signIn, sql, withSite } from "./helpers/site.mjs";

after(cleanup);

const DOMAIN = "peserta-demo.invalid";
const evidence = ["--operator=Operator Uji", "--evidence-ref=AUDIT-DEMO"];
const cli = (site, args) => spawnSync("php", [...SQLITE, join(repo, "scripts", "maintenance", "demo-learners.php"), "--expect-environment=local", ...args], {
  cwd: repo,
  encoding: "utf8",
  env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
});
const ok = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
const count = (site, table, where = "1 = 1") => Number(rows(site, `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)[0].n);
const TABLES = ["users", "user_profiles", "learner_curriculum_assignments", "assessment_attempts", "assessment_attempt_items", "module_learning_events", "user_progress", "learner_academic_state", "learner_achievements", "certificate_issuances", "farm_data"];
const snapshot = (site) => Object.fromEntries(TABLES.map((table) => [table, count(site, table)]));

test("demo learners fill the hall of fame through real attempts, without certificates or logins", async () => {
  const { site, learnerA } = await setup("demo-apply");
  await withSite(site, async (api) => {
    await passModule(await signIn(api.port, "peserta-a@example.test"), site, 1);
  });
  const before = snapshot(site);

  const plan = cli(site, ["--dry-run", "--count=6"]);
  ok(plan);
  assert.deepEqual(snapshot(site), before, "a dry run writes nothing");

  const applied = cli(site, ["--apply", "--count=6", ...evidence]);
  ok(applied);
  assert.doesNotMatch(applied.stdout, /password/i);
  assert.equal(count(site, "users", `email LIKE '%@${DOMAIN}'`), 6);
  assert.equal(count(site, "users", `email LIKE '%@${DOMAIN}' AND role <> 'user'`), 0);
  assert.ok(count(site, "assessment_attempts", "status = 'submitted' OR passed = 1") > before.assessment_attempts);
  assert.equal(count(site, "certificate_issuances"), before.certificate_issuances, "no credential is ever issued");

  await withSite(site, async (api) => {
    const viewer = await signIn(api.port, "peserta-b@example.test");
    const fame = (await viewer.get("/api/hall-of-fame")).json.data;
    assert.ok(fame.total >= 6, JSON.stringify(fame).slice(0, 200));
    assert.ok(fame.entries.every((entry) => entry.points > 0 && entry.certificateCount === 0));
    assert.equal(new Set(fame.entries.map((entry) => entry.name)).size, fame.entries.length);
    assert.ok(new Set(fame.entries.map((entry) => entry.points)).size > 2, "the board is not six identical scores");
  });

  const real = rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ?", [learnerA])[0].n;
  assert.equal(cli(site, ["--apply", "--count=6", ...evidence]).status, 4, "a second run stops instead of doubling");
  assert.equal(count(site, "users", `email LIKE '%@${DOMAIN}'`), 6);

  ok(cli(site, ["--dry-run", "--remove"]));
  assert.equal(count(site, "users", `email LIKE '%@${DOMAIN}'`), 6, "a removal dry run writes nothing");
  ok(cli(site, ["--apply", "--remove", ...evidence]));
  assert.deepEqual(snapshot(site), before, "removal returns every table to where it was");
  assert.equal(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ?", [learnerA])[0].n, real);
});

test("removal touches only the demo domain, and an unsafe run is refused", async () => {
  const { site } = await setup("demo-guards");
  sql(site, `UPDATE users SET full_name = 'Peserta Nyata' WHERE email = 'peserta-a@example.test'`);
  assert.equal(cli(site, ["--apply", "--count=2"]).status, 2, "an apply needs an operator and evidence");
  assert.equal(cli(site, ["--apply", "--count=500", ...evidence]).status, 2, "the count is bounded");
  assert.equal(cli(site, ["--apply", "--dry-run", "--count=2"]).status, 2);
  assert.equal(spawnSync("php", [...SQLITE, join(repo, "scripts", "maintenance", "demo-learners.php"), "--expect-environment=production", "--dry-run"], { cwd: repo, encoding: "utf8", env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }) }).status, 3, "the environment must match");
  ok(cli(site, ["--apply", "--count=2", ...evidence]));
  ok(cli(site, ["--apply", "--remove", ...evidence]));
  assert.equal(count(site, "users", "full_name = 'Peserta Nyata'"), 1);
  assert.equal(count(site, "users", "email LIKE '%@example.test'"), 3);
});
