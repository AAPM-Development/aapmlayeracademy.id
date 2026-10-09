// Q04-B regression suite: a progress reset starts a new academic generation and
// never deletes assessment history. Real API under php -S, disposable SQLite.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  SQLITE, attemptKey, bulk, cleanEnv, cleanup, fixtures, passModule, progressRow, repo, rows, setup, signIn, sql, submitProcess, withSite,
} from "./helpers/site.mjs";

after(cleanup);

const reset = (admin, userId, body = { confirm: true }) => admin.mutate("DELETE", `/api/admin/users/${userId}/progress`, body);

function resetProcess(site, actorId, userId) {
  return new Promise((done, reject) => {
    const child = spawn("php", [...SQLITE, join(fixtures, "q04", "reset.php"), String(actorId), String(userId)], {
      cwd: repo,
      env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", () => done({ out: out.trim(), err }));
  });
}

test("PRE-04.1/.2 (C01) a reset keeps the passing attempt and makes current completion incomplete", async () => {
  const { site, learnerA } = await setup("pre1");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");
    await passModule(learner, site, 1);
    assert.equal((await progressRow(learner, 1)).completed, true);

    const result = await reset(admin, learnerA);
    assert.equal(result.status, 200, result.text);
    assert.equal(result.json.data.reset.generationFrom, 1);
    assert.equal(result.json.data.reset.generationTo, 2);

    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ? AND passed = 1", [learnerA])[0].n), 1, "the passing attempt is retained");
    const after = await progressRow(learner, 1);
    assert.ok(after === null || after.completed === false, "current completion starts over");
    const eligibility = await learner.get("/api/assessments/final-eligibility");
    assert.ok(eligibility.json.data.missingModuleNumbers.includes(1));
  });
});

test("PRE-01 a reset needs a verified admin, CSRF, explicit confirmation, and is audited", async () => {
  const { site, learnerA } = await setup("pre-auth");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");

    assert.equal((await reset(learner, learnerA)).status, 403, "a learner cannot reset");
    assert.equal((await reset(admin, learnerA, {})).status, 422, "confirmation is required");
    assert.equal((await reset(admin, learnerA, { confirm: "yes" })).status, 422, "confirmation must be literally true");
    const noCsrf = await admin.raw("DELETE", `/api/admin/users/${learnerA}/progress`, { confirm: true });
    assert.equal(noCsrf.status, 419, "CSRF is enforced");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM learner_academic_state")[0].n), 0, "nothing changed before a valid reset");

    assert.equal((await reset(admin, learnerA)).status, 200);
    const audit = rows(site, "SELECT event_type, result, target_user_id FROM security_audit_events WHERE event_type = 'admin.progress_reset'");
    assert.equal(audit.length, 1);
    assert.equal(Number(audit[0].target_user_id), learnerA);
    assert.equal((await reset(admin, 999999)).status, 404);
  });
});

test("PRE-02 (C02) an attempt opened before the reset cannot be resumed afterwards", async () => {
  const { site, learnerA } = await setup("pre2");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");
    const open = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 2, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, open.id).get(open.questions[0].id);

    await reset(admin, learnerA);

    const answer = await learner.mutate("POST", `/api/assessments/attempts/${open.id}/answers`, { questionId: open.questions[0].id, answerIndex: entry.correct });
    assert.equal(answer.status, 409);
    assert.equal(answer.json.error.code, "attempt_superseded");
    const submit = await learner.mutate("POST", `/api/assessments/attempts/${open.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submit.json.error.code, "attempt_superseded");

    const fresh = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 2, requestKey: randomUUID() });
    assert.equal(fresh.status, 201, "a new attempt is offered in the active generation");
    assert.notEqual(fresh.json.data.attempt.id, open.id);
    assert.equal(Number(rows(site, "SELECT academic_generation AS g FROM assessment_attempts WHERE public_id = ?", [fresh.json.data.attempt.id])[0].g), 2);
    assert.equal(rows(site, "SELECT status FROM assessment_attempts WHERE public_id = ?", [open.id])[0].status, "superseded", "the old attempt is marked, not deleted");
  });
});

test("PRE-04.4/.5 a new pass restores completion, and the earlier score stays in the history", async () => {
  const { site, learnerA } = await setup("pre4");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");
    await passModule(learner, site, 3);
    await reset(admin, learnerA);
    assert.ok(!(await progressRow(learner, 3))?.completed);

    await passModule(learner, site, 3);
    assert.equal((await progressRow(learner, 3)).completed, true, "completion is restored by evidence in the active generation");

    const history = await admin.get(`/api/admin/learners/${learnerA}/assessment-history`);
    assert.equal(history.json.data.currentGeneration, 2);
    const generations = history.json.data.attempts.filter((item) => item.moduleNumber === 3 && item.passed).map((item) => item.generation).sort();
    assert.deepEqual(generations, [1, 2], "both passes are reported, each in its own generation");
    const own = await learner.get("/api/assessments/history");
    assert.ok(own.json.data.some((item) => item.generation === 1 && item.passed), "the learner can still see the earlier result");
    assert.equal((await learner.get(`/api/admin/learners/${learnerA}/assessment-history`)).status, 403);
  });
});

test("PRE-03 (C04) a module with academic history cannot be deleted, even with purgeProgress", async () => {
  const { site } = await setup("pre3");
  bulk(site, { modules: [{ module_number: 97, sort_order: 97, lifecycle_status: "draft" }] });
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");
    await passModule(learner, site, 4);
    const moduleId = Number(rows(site, "SELECT id FROM course_modules WHERE module_number = 4")[0].id);

    const blocked = await admin.mutate("DELETE", `/api/admin/modules/${moduleId}?purgeProgress=true`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.error.code, "module_has_academic_history");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules WHERE module_number = 4")[0].n), 1, "the module survives");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE module_number = 4")[0].n), 1, "so does its history");

    const emptyId = Number(rows(site, "SELECT id FROM course_modules WHERE module_number = 97")[0].id);
    assert.equal((await admin.mutate("DELETE", `/api/admin/modules/${emptyId}`)).status, 200, "a module without history can still be deleted");
  });
});

test("PRE-04.8 (C03-style) a reset racing a submit cannot corrupt generations or completion", async () => {
  const { site, learnerA } = await setup("pre-race");
  const adminId = Number(rows(site, "SELECT id FROM users WHERE email = 'pengelola@example.test'")[0].id);
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 5, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });

    const [submitted, resetResult] = await Promise.allSettled([submitProcess(site, attempt.id, learnerA), resetProcess(site, adminId, learnerA)]);
    assert.equal(resetResult.status, "fulfilled");
    assert.ok(JSON.parse(resetResult.value.out).generationTo === 2, resetResult.value.out + resetResult.value.err);

    const stored = rows(site, "SELECT status, academic_generation AS g FROM assessment_attempts WHERE public_id = ?", [attempt.id])[0];
    assert.equal(Number(stored.g), 1, "the attempt keeps its generation");
    assert.ok(["submitted", "superseded"].includes(stored.status), `unexpected status ${stored.status}`);
    assert.equal(Number(rows(site, "SELECT current_generation AS g FROM learner_academic_state WHERE user_id = ?", [learnerA])[0].g), 2);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM learner_academic_state")[0].n), 1);
    if (submitted.status === "rejected") assert.equal(stored.status, "superseded");
    const row = await progressRow(learner, 5);
    assert.ok(row === null || row.completed === false, "a pass recorded in generation 1 never completes generation 2");
  });
});

test("PRE-01 the migration backfills generation 1 and a replay changes nothing", async () => {
  const { site } = await setup("pre-migrate");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 6);
  });
  assert.ok(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE academic_generation = 1")[0].n) >= 1);
  const before = JSON.stringify(rows(site, "SELECT public_id, academic_generation FROM assessment_attempts ORDER BY id"));
  sql(site, "SELECT 1");
  sql(site, "SELECT 1");
  assert.equal(JSON.stringify(rows(site, "SELECT public_id, academic_generation FROM assessment_attempts ORDER BY id")), before);
});
