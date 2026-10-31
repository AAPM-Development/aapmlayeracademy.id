// Learner scheme rules that span the assessment, certificate, and reward layers:
// what a certificate is worth, and how a quiz is presented on every attempt.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { attemptKey, cleanup, passModule, rows, setup, signIn, sql, withSite } from "./helpers/site.mjs";

after(cleanup);

const claim = (api, tierNumber) => api.mutate("POST", "/api/certificates/claims", { tierNumber, requestKey: randomUUID() });
const learning = async (api) => (await api.get("/api/profile")).json.data.learning;
const achievement = (summary, id) => summary.achievements.find((item) => item.id === id);
const legacyCertificate = (site, userId, level) =>
  sql(site, "INSERT INTO certificates (user_id, level_number, level_name, score, exam_type, holder_name, issued_at) VALUES (?, ?, ?, 90, 'final', 'Peserta Uji', '2026-01-01 00:00:00')", [userId, level, `Tingkat ${level}`]);

test("a verified certificate counts toward points and certificate achievements", async () => {
  const { site } = await setup("scheme-claim");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    const before = await learning(learner);
    assert.equal(before.certificateCount, 0);

    assert.equal((await claim(learner, 1)).status, 201);
    const after = await learning(learner);
    assert.equal(after.certificateCount, 1);
    assert.equal(after.points - before.points, 150);
    assert.equal(achievement(after, "certified").unlocked, true);
  });
});

test("a tier counts once, and a revoked certificate stops counting", async () => {
  const { site, learnerA } = await setup("scheme-count");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    assert.equal((await claim(learner, 1)).status, 201);

    legacyCertificate(site, learnerA, 1);
    assert.equal((await learning(learner)).certificateCount, 1, "legacy and verified records of one tier are one certificate");

    legacyCertificate(site, learnerA, 2);
    assert.equal((await learning(learner)).certificateCount, 2, "a legacy certificate of another tier still counts");

    sql(site, "DELETE FROM certificates WHERE user_id = ?", [learnerA]);
    sql(site, "UPDATE certificate_issuances SET status = 'revoked' WHERE user_id = ?", [learnerA]);
    assert.equal((await learning(learner)).certificateCount, 0);
  });
});

test("revoking a certificate also stops a legacy record of that tier from counting", async () => {
  const { site, learnerA } = await setup("scheme-revoked-legacy");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    assert.equal((await claim(learner, 1)).status, 201);
    legacyCertificate(site, learnerA, 1);
    legacyCertificate(site, learnerA, 2);

    sql(site, "UPDATE certificate_issuances SET status = 'revoked' WHERE user_id = ? AND tier_number = 1", [learnerA]);
    assert.equal((await learning(learner)).certificateCount, 1, "only the untouched legacy tier 2 still counts");
  });
});

test("admin lists read the same certificate count as the learner", async () => {
  const { site } = await setup("scheme-admin");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    assert.equal((await claim(learner, 1)).status, 201);

    const admin = await signIn(api.port, "pengelola@example.test");
    const accounts = (await admin.get("/api/admin/users")).json.data;
    const row = (accounts.users ?? accounts).find((user) => user.email === "peserta-a@example.test");
    assert.equal(row.certificateCount, 1);
  });
});

test("each attempt shuffles questions and options while the key still marks the right option", async () => {
  const { site } = await setup("scheme-shuffle");
  sql(site, "DELETE FROM quiz_questions WHERE module_number = 1");
  for (let index = 0; index < 40; index++) {
    sql(site, "INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective) VALUES (1, ?, ?, 0, 'Alasan', 'medium', 'mcq', 'Tujuan')", [
      `Soal ${index}`,
      JSON.stringify([`Benar ${index}`, `Salah A${index}`, `Salah B${index}`, `Salah C${index}`]),
    ]);
  }
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const started = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 1, requestKey: randomUUID() });
    assert.equal(started.status, 201, started.text);
    const attempt = started.json.data.attempt;

    const stored = rows(site, "SELECT i.ordinal, i.question_snapshot_json FROM assessment_attempt_items i JOIN assessment_attempts a ON a.id = i.attempt_id WHERE a.public_id = ? ORDER BY i.ordinal", [attempt.id]);
    assert.equal(stored.length, 40);
    const snapshots = stored.map((row) => JSON.parse(row.question_snapshot_json));
    assert.notDeepEqual(snapshots.map((item) => item.question), Array.from({ length: 40 }, (_, index) => `Soal ${index}`), "question order is not the bank order");
    assert.ok(snapshots.some((item) => item.correctIndex !== 0), "the key does not stay on the bank position");
    for (const item of snapshots) {
      const number = item.question.split(" ")[1];
      assert.equal(item.options.length, 4);
      assert.equal(item.options[item.correctIndex], `Benar ${number}`);
      assert.deepEqual([...item.options].sort(), [`Benar ${number}`, `Salah A${number}`, `Salah B${number}`, `Salah C${number}`].sort());
    }

    const resumed = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 1, requestKey: randomUUID() });
    assert.equal(resumed.json.data.attempt.id, attempt.id);
    assert.deepEqual(resumed.json.data.attempt.questions.map((item) => [item.question, item.options]), attempt.questions.map((item) => [item.question, item.options]), "a resumed attempt keeps its order");

    const key = attemptKey(site, attempt.id);
    for (const question of attempt.questions) {
      const answered = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: question.id, answerIndex: key.get(question.id).correct });
      assert.equal(answered.status, 200, answered.text);
    }
    const submitted = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submitted.json.data.attempt.scorePercent ?? submitted.json.data.result?.scorePercent ?? submitted.json.data.attempt.result?.scorePercent, 100, submitted.text);
  });
});
