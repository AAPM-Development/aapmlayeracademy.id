// Expo demo accounts: real CLI under disposable SQLite. They are created through the Super Admin
// account path, brought to their group's state, signed in through the real API, and removed
// without a trace. The shared password is generated per run and passed only through the environment.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { Api, SQLITE, cleanEnv, cleanup, passModule, repo, rows, seedAccount, setup, signIn, sql, withSite } from "./helpers/site.mjs";

after(cleanup);

const DOMAIN = "demo.aapm.co.id";
const PASSWORD = `Expo${randomBytes(6).toString("hex")}7`;
const evidence = ["--operator=Operator Uji", "--evidence-ref=AUDIT-EXPO"];
const GROUPS = {
  baru: ["baru01", "baru02", "baru03", "baru04", "baru05"],
  siap: ["siap01", "siap02", "siap03", "siap04", "siap05"],
  data: ["data01", "data02", "data03", "data04", "data05"],
};
const MODULES = { data01: 3, data02: 5, data03: 7, data04: 9, data05: 12 };
const WEEKS = { data01: 6, data02: 7, data03: 8, data04: 7, data05: 8 };
const email = (handle) => `${handle}@${DOMAIN}`;

const cli = (site, args, password = PASSWORD) => spawnSync("php", [...SQLITE, join(repo, "scripts", "maintenance", "expo-accounts.php"), "--expect-environment=local", ...args], {
  cwd: repo,
  encoding: "utf8",
  env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config, ...(password === null ? {} : { AAPM_EXPO_DEMO_PASSWORD: password }) }),
});
const ok = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
const quiet = (result) => assert.ok(!(result.stdout + result.stderr).includes(PASSWORD), "the password is never printed");
const count = (site, table, where = "1 = 1", params = []) => Number(rows(site, `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params)[0].n);
const TABLES = ["users", "user_profiles", "learner_curriculum_assignments", "assessment_attempts", "assessment_attempt_items", "module_learning_events", "user_progress", "learner_academic_state", "learner_achievements", "certificate_issuances", "farm_data", "email_verification_tokens"];
const snapshot = (site) => Object.fromEntries(TABLES.map((table) => [table, count(site, table)]));
const account = (site, handle) => rows(site, "SELECT * FROM users WHERE email = ?", [email(handle)])[0];
const userId = (site, handle) => Number(account(site, handle).id);

test("the Expo accounts are created in three groups, rerun without duplicates, sign in, and leave no trace", async () => {
  const { site, learnerA } = await setup("expo-apply");
  await withSite(site, async (api) => {
    await passModule(await signIn(api.port, "peserta-a@example.test"), site, 1);
  });
  const before = snapshot(site);
  const realAttempts = count(site, "assessment_attempts", "user_id = ?", [learnerA]);

  const plan = cli(site, ["--dry-run"]);
  ok(plan);
  quiet(plan);
  assert.equal(plan.stdout.match(/: akan dibuat/g)?.length, 15, plan.stdout);
  assert.deepEqual(snapshot(site), before, "a dry run writes nothing");

  const applied = cli(site, ["--apply", ...evidence]);
  ok(applied);
  quiet(applied);
  assert.equal(count(site, "users", "email LIKE ?", [`%@${DOMAIN}`]), 15);
  assert.equal(count(site, "users", "email LIKE ? AND role <> 'user'", [`%@${DOMAIN}`]), 0, "every account is a learner");
  const policy = rows(site, "SELECT DISTINCT a.policy_version, a.assignment_source FROM learner_curriculum_assignments a JOIN users u ON u.id = a.user_id WHERE u.email LIKE ?", [`%@${DOMAIN}`]);
  assert.deepEqual(policy, [{ policy_version: "academy-v1", assignment_source: "admin_create" }], "each account has its curriculum policy row from the Super Admin path");
  assert.equal(count(site, "learner_curriculum_assignments a JOIN users u ON u.id = a.user_id", "u.email LIKE ?", [`%@${DOMAIN}`]), 15);

  for (const handle of GROUPS.baru) {
    const row = account(site, handle);
    assert.equal(row.email_verified_at, null, `${handle} waits for verification`);
    assert.ok(row.verification_required_at, `${handle} is pending like a fresh registration`);
    assert.equal(count(site, "user_profiles", "user_id = ? AND (bio <> '' OR avatar_data <> '')", [row.id]), 0, `${handle} has an empty profile`);
  }
  for (const handle of [...GROUPS.siap, ...GROUPS.data]) {
    const row = account(site, handle);
    assert.ok(row.email_verified_at, `${handle} is verified`);
    const profile = rows(site, "SELECT bio, hall_of_fame_opt_in, avatar_data FROM user_profiles WHERE user_id = ?", [row.id])[0];
    assert.ok(profile.bio.length > 40 && !/[[\]]/.test(profile.bio), `${handle} has a plain bio`);
    assert.equal(Number(profile.hall_of_fame_opt_in), 0, "the hall of fame stays at the app default");
    assert.equal(profile.avatar_data, "");
  }
  for (const handle of [...GROUPS.baru, ...GROUPS.siap]) {
    const id = userId(site, handle);
    assert.equal(count(site, "assessment_attempts", "user_id = ?", [id]) + count(site, "module_learning_events", "user_id = ?", [id]) + count(site, "farm_data", "user_id = ?", [id]), 0, `${handle} has no activity`);
  }
  for (const handle of GROUPS.data) {
    const id = userId(site, handle);
    assert.equal(count(site, "assessment_attempts", "user_id = ? AND status = 'submitted' AND passed = 1", [id]), MODULES[handle], `${handle} passed its first modules`);
    assert.equal(count(site, "assessment_attempts", "user_id = ? AND (score_percent < 80 OR score_percent > 100)", [id]), 0);
    assert.ok(count(site, "module_learning_events", "user_id = ? AND event_type = 'study_time_increment'", [id]) >= MODULES[handle]);
    assert.ok(count(site, "module_learning_events", "user_id = ? AND event_type = 'practice_attested'", [id]) > 0);
    assert.equal(count(site, "farm_data", "user_id = ?", [id]), WEEKS[handle]);
    const weeks = rows(site, "SELECT week, hen_day_production, fcr, mortality FROM farm_data WHERE user_id = ? ORDER BY week", [id]);
    assert.ok(weeks.every((row, index) => index === 0 || Number(row.week) === Number(weeks[index - 1].week) + 1), "consecutive weeks");
    assert.ok(weeks.every((row) => Number(row.hen_day_production) >= 85 && Number(row.hen_day_production) <= 96 && Number(row.fcr) > 1.7 && Number(row.fcr) < 2.2 && Number(row.mortality) < 0.5));
  }
  assert.equal(count(site, "certificate_issuances"), before.certificate_issuances, "no certificate is claimed");

  const once = snapshot(site);
  const again = cli(site, ["--apply", ...evidence]);
  ok(again);
  quiet(again);
  assert.equal(again.stdout.match(/: sudah ada/g)?.length, 15, again.stdout);
  assert.deepEqual(snapshot(site), once, "a second run duplicates nothing");
  assert.equal(JSON.parse(again.stdout.slice(again.stdout.indexOf("{"))).changed, false);

  const verified = cli(site, ["--verify"]);
  ok(verified);
  quiet(verified);
  assert.equal(verified.stdout.match(/^PASS /gm)?.length, 15, verified.stdout);
  const wrong = cli(site, ["--verify"], "Lain12345");
  assert.equal(wrong.status, 1);
  assert.equal(wrong.stdout.match(/^FAIL .*kata sandi tidak cocok/gm)?.length, 15, wrong.stdout);

  await withSite(site, async (api) => {
    for (const [handle, status] of [["baru01", "pending"], ["siap01", "verified"], ["data05", "verified"]]) {
      const learner = await signIn(api.port, email(handle), PASSWORD);
      const me = (await learner.get("/api/auth/me")).json.data.user;
      assert.equal(me.emailVerificationStatus, status, handle);
      assert.equal(me.role, "learner");
      const profile = (await learner.get("/api/profile")).json.data;
      assert.equal(profile.profile.bio === "", handle === "baru01");
      const progress = (await learner.get("/api/progress")).json.data;
      const farm = (await learner.get("/api/farm-data")).json.data;
      if (handle === "data05") {
        assert.equal(progress.filter((row) => row.completed && row.verificationStatus === "verified").length, 12);
        assert.equal(farm.length, 8);
        assert.ok(farm.every((row) => row.henDayProduction > 0 && row.revenue > row.cost));
      } else {
        assert.deepEqual([progress.length, farm.length], [0, 0]);
      }
    }
    const refused = await new Api(api.port).mutate("POST", "/api/auth/login", { email: email("siap02"), password: "Lain12345" });
    assert.equal(refused.status, 401);
  });

  // What a visitor may change at the booth, put back by the next run without touching activity.
  // Opening the profile above recorded achievements, so the baseline is taken here.
  const visited = snapshot(site);
  sql(site, "UPDATE users SET email_verified_at = '2026-11-04 09:00:00' WHERE email = ?", [email("baru02")]);
  sql(site, "UPDATE users SET email_verified_at = NULL WHERE email = ?", [email("siap03")]);
  sql(site, "UPDATE user_profiles SET bio = 'diubah pengunjung' WHERE user_id = ?", [userId(site, "siap04")]);
  sql(site, "UPDATE farm_data SET hen_day_production = 10 WHERE user_id = ? AND week = (SELECT MIN(week) FROM farm_data WHERE user_id = ?)", [userId(site, "data01"), userId(site, "data01")]);
  assert.equal(cli(site, ["--verify"]).status, 1);
  const restored = cli(site, ["--apply", ...evidence]);
  ok(restored);
  assert.equal(restored.stdout.match(/dipulihkan/g)?.length, 3, restored.stdout);
  assert.match(restored.stdout, /data01@demo\.aapm\.co\.id .*1 diperbarui/);
  ok(cli(site, ["--verify"]));
  assert.deepEqual(snapshot(site), visited, "restoring state adds no rows");

  ok(cli(site, ["--dry-run", "--remove"], null));
  assert.equal(count(site, "users", "email LIKE ?", [`%@${DOMAIN}`]), 15, "a removal dry run writes nothing");
  const removed = cli(site, ["--apply", "--remove", ...evidence], null);
  ok(removed);
  assert.equal(removed.stdout.match(/: dihapus/g)?.length, 15, removed.stdout);
  assert.deepEqual(snapshot(site), before, "removal returns every table to where it was");
  assert.equal(count(site, "assessment_attempts", "user_id = ?", [learnerA]), realAttempts, "a real learner keeps its history");
  assert.equal(count(site, "security_audit_events", "event_type = 'demo.expo_accounts_removed'"), 1);
});

test("the accounts follow the active 23-module curriculum and pass its 10-question quizzes", async () => {
  const { site } = await setup("expo-v2");
  const admin = ["--expect-environment=local", "--actor-email=pengelola@example.test"];
  const curriculum = (script, args) => spawnSync("php", [...SQLITE, join(repo, "scripts", "curriculum", script), ...args], { cwd: repo, encoding: "utf8", env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }) });
  ok(curriculum("import-curriculum-update.php", [`--file=${join("scripts", "curriculum", "data", "2026-10-31-kurikulum-v2.json")}`, ...admin, "--apply", "--create-missing", ...evidence]));
  ok(curriculum("prepare-policy-v2.php", [...admin, "--apply"]));
  ok(curriculum("activate-policy.php", ["--policy-version=academy-v2", "--expect-environment=local", "--apply", ...evidence]));

  ok(cli(site, ["--apply", ...evidence]));
  assert.equal(count(site, "learner_curriculum_assignments a JOIN users u ON u.id = a.user_id", "u.email LIKE ? AND a.policy_version = 'academy-v2'", [`%@${DOMAIN}`]), 15, "new accounts start on the new curriculum");
  const id = userId(site, "data05");
  const scores = rows(site, "SELECT total_questions, score_percent, passed FROM assessment_attempts WHERE user_id = ? AND assessment_type = 'module_quiz'", [id]);
  assert.equal(scores.length, 12);
  assert.ok(scores.every((row) => Number(row.total_questions) === 10 && Number(row.passed) === 1 && Number(row.score_percent) >= 80 && Number(row.score_percent) <= 100), JSON.stringify(scores));
  assert.ok(new Set(scores.map((row) => row.score_percent)).size > 1, "scores vary between modules");
  ok(cli(site, ["--verify"]));
  assert.equal(count(site, "certificate_issuances", "user_id = ?", [id]), 0);

  // A visitor may claim an open tier at the booth; removal still clears the account.
  await withSite(site, async (api) => {
    const visitor = await signIn(api.port, email("data01"), PASSWORD);
    const claim = await visitor.mutate("POST", "/api/certificates/claims", { tierNumber: 1, requestKey: `expo-claim-${randomBytes(4).toString("hex")}` });
    assert.ok([200, 201].includes(claim.status), claim.text);
  });
  const blocked = cli(site, ["--verify"]);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /FAIL data01@demo\.aapm\.co\.id .*1 sertifikat tercatat/);
  ok(cli(site, ["--apply", "--remove", ...evidence], null));
  assert.equal(count(site, "users", "email LIKE ?", [`%@${DOMAIN}`]), 0);
  assert.equal(count(site, "certificate_issuances"), 0);
});

test("an address held by someone else stops every write, and unsafe runs are refused", async () => {
  const { site } = await setup("expo-guards");
  seedAccount(site, { email: email("baru03"), verified: true, name: "Orang Lain" });
  const before = snapshot(site);
  assert.equal(cli(site, ["--dry-run"]).status, 4, "the dry run reports the conflict");
  const refused = cli(site, ["--apply", ...evidence]);
  assert.equal(refused.status, 4);
  assert.match(refused.stderr, /baru03@demo\.aapm\.co\.id: email sudah dipakai akun dengan nama lain/);
  assert.deepEqual(snapshot(site), before, "nothing was written");
  assert.equal(cli(site, ["--apply", "--remove", ...evidence], null).status, 4, "removal refuses too");
  assert.equal(count(site, "users", "full_name = 'Orang Lain'"), 1);

  assert.equal(cli(site, ["--apply"]).status, 2, "an apply needs an operator and evidence");
  assert.equal(cli(site, ["--apply", "--dry-run"]).status, 2);
  assert.equal(cli(site, ["--verify", "--apply", ...evidence]).status, 2);
  assert.equal(cli(site, ["--verify", "--remove"]).status, 2);
  assert.equal(cli(site, ["--apply", "--count=3", ...evidence]).status, 2, "unknown options are refused");
  assert.equal(cli(site, ["--apply", ...evidence], null).status, 2, "the password must come from the environment");
  for (const weak of ["Pendek1", "TanpaAngka", "123456789"]) {
    const result = cli(site, ["--apply", ...evidence], weak);
    assert.equal(result.status, 2, weak);
    assert.match(result.stderr, /Kata sandi bersama belum siap/);
  }
  assert.equal(cli(site, ["--verify"], null).status, 2);
  assert.equal(spawnSync("php", [...SQLITE, join(repo, "scripts", "maintenance", "expo-accounts.php"), "--expect-environment=production", "--dry-run"], { cwd: repo, encoding: "utf8", env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }) }).status, 3, "the environment must match");
  assert.deepEqual(snapshot(site), before);
});
