// Q05 curriculum publishing: draft isolation, immutable revisions, concurrency control,
// archive and delete protection, media references, versioned policies, and operator
// activation. Real API and CLI under disposable SQLite. Browser and MySQL cases are skipped.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  SQLITE, attemptKey, cleanEnv, cleanup, makeSite, passModule, progressRow, repo, rows, run, seedCurriculum, seedAccount, setup, signIn, sql, withSite,
} from "./helpers/site.mjs";

after(cleanup);

const moduleIdOf = (site, number) => Number(rows(site, "SELECT id FROM course_modules WHERE module_number = ?", [number])[0].id);
const adminIdOf = (site) => Number(rows(site, "SELECT id FROM users WHERE email = 'pengelola@example.test'")[0].id);

/** Loads the editor's draft exactly as the admin client does: array-typed list fields. */
async function loadDraft(admin, moduleId) {
  const reply = await admin.get(`/api/admin/modules/${moduleId}?view=draft`);
  assert.equal(reply.status, 200, reply.text);
  const payload = { ...reply.json.data.module.draftPayload };
  for (const key of ["learningObjectives", "keyTakeaways", "checklist"]) {
    payload[key] = JSON.parse(payload[key] || "[]");
  }
  return { version: reply.json.data.draft.version, payload };
}

async function saveDraft(admin, moduleId, patch = {}) {
  const { version, payload } = await loadDraft(admin, moduleId);
  return admin.mutate("PUT", `/api/admin/modules/${moduleId}`, { ...payload, ...patch, expectedDraftVersion: version });
}

async function draftQuestions(admin, moduleId) {
  const reply = await admin.get(`/api/admin/modules/${moduleId}/questions?view=draft`);
  return reply.json.data;
}

async function publish(admin, moduleId, version) {
  return admin.mutate("POST", `/api/admin/modules/${moduleId}/publish`, { expectedDraftVersion: version, confirm: true });
}

function saveDraftProcess(site, moduleId, expected, actorId, title) {
  return new Promise((done, reject) => {
    const child = spawn("php", [...SQLITE, join(repo, "tests", "fixtures", "q05", "save-draft.php"), String(moduleId), String(expected), String(actorId), title], {
      cwd: repo,
      env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => done({ code, out: out.trim(), err: err.trim() }));
  });
}

function cli(site, args) {
  return spawnSync("php", [...SQLITE, join(repo, "scripts", "curriculum", "activate-policy.php"), ...args], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
}

function cliProcess(site, args) {
  return new Promise((done) => {
    const child = spawn("php", [...SQLITE, join(repo, "scripts", "curriculum", "activate-policy.php"), ...args], {
      cwd: repo,
      env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => done({ code, out: out.trim(), err: err.trim() }));
  });
}

/* ------------------------------------------------------ migration and backfill */

test("P01 and P02 the 22 existing modules are published revisions, and question banks match the live bank", async () => {
  const { site } = await setup("p01");
  await withSite(site, async (api) => {
    await signIn(api.port, "peserta-a@example.test");
  });
  const published = Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules WHERE lifecycle_status = 'active' AND published_revision_id IS NOT NULL")[0].n);
  assert.equal(published, 22, "every seeded module is active and published");
  const bankItems = Number(rows(site, "SELECT COUNT(*) AS n FROM question_bank_revision_items i INNER JOIN question_bank_revisions b ON b.id = i.bank_revision_id WHERE b.scope_type = 'module' AND b.revision_number = 1")[0].n);
  const live = Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number BETWEEN 1 AND 22")[0].n);
  assert.equal(bankItems, live, "backfilled question banks carry every live question unchanged");
});

test("P35 the v1 academic policy is identical after a migration replay", async () => {
  const { site } = await setup("p35");
  await withSite(site, async (api) => {
    await signIn(api.port, "peserta-a@example.test");
  });
  const before = JSON.stringify(rows(site, "SELECT policy_version, status, requirements_json FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'"));
  const first = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const second = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Curriculum schema: present/);
  assert.equal(JSON.stringify(rows(site, "SELECT policy_version, status, requirements_json FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'")), before);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM schema_migrations WHERE migration_key = ?", ["20261101_curriculum_publishing_v1"])[0].n), 1);
});

test("P51 a fresh installation migrates with the curriculum schema present and replays cleanly", async () => {
  const site = makeSite("p51");
  seedCurriculum(site);
  const first = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /Curriculum schema: present/);
  const second = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(second.status, 0, second.stdout + second.stderr);
});

/* ------------------------------------------------------------ draft isolation */

test("P03 a new module is a draft and does not appear in the learner catalogue", async () => {
  const { site } = await setup("p03");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const levelName = rows(site, "SELECT level_name FROM course_modules WHERE level_number = 1 LIMIT 1")[0].level_name;
    const created = await admin.mutate("POST", "/api/admin/modules", {
      levelNumber: 1, levelName, moduleNumber: 200, title: "Modul Baru", content: "Materi baru", learningObjectives: [], keyTakeaways: [], checklist: [],
    });
    assert.equal(created.status, 201, created.text);
    assert.equal(rows(site, "SELECT lifecycle_status AS s FROM course_modules WHERE module_number = 200")[0].s, "draft");
    const catalogue = await learner.get("/api/modules");
    assert.equal(catalogue.json.data.some((item) => item.moduleNumber === 200), false, "drafts are invisible to learners");
    const reuse = await admin.mutate("POST", "/api/admin/modules", { levelNumber: 1, levelName, moduleNumber: 200, title: "Lagi", content: "x", learningObjectives: [], keyTakeaways: [], checklist: [] });
    assert.equal(reuse.json.error.code, "module_number_exists", "a number is never reused");
  });
});

test("P04 and P05 saving a draft leaves the published lesson unchanged; preview shows the draft to admins only", async () => {
  const { site } = await setup("p04");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const id = moduleIdOf(site, 2);
    const publishedTitle = rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title;
    const saved = await saveDraft(admin, id, { title: "Judul Draf Baru" });
    assert.equal(saved.status, 200, saved.text);
    assert.equal(rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title, publishedTitle, "live row is untouched");
    const learnerView = (await learner.get("/api/modules")).json.data.find((item) => item.moduleNumber === 2);
    assert.equal(learnerView.title, publishedTitle, "learners still see the published title");
    const preview = await admin.get(`/api/admin/modules/${id}/preview`);
    assert.equal(preview.json.data.module.title, "Judul Draf Baru", "admin preview shows the draft");
    assert.equal((await learner.get(`/api/admin/modules/${id}/preview`)).status, 403, "learners cannot preview");
  });
});

test("P07 publishing a valid draft creates a new revision that learners then see", async () => {
  const { site } = await setup("p07");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const id = moduleIdOf(site, 2);
    const before = Number(rows(site, "SELECT COUNT(*) AS n FROM module_revisions WHERE module_id = ?", [id])[0].n);
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Terbit" });
    const reply = await publish(admin, id, version + 1);
    assert.equal(reply.status, 200, reply.text);
    assert.equal(reply.json.data.revisionNumber, before + 1);
    assert.equal((await learner.get("/api/modules")).json.data.find((item) => item.moduleNumber === 2).title, "Judul Terbit");
  });
});

test("P08, P20 and P22 an empty required question bank cannot be published; the live lesson is unchanged", async () => {
  const { site } = await setup("p08");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 6);
    const liveTitle = rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title;
    const liveQuestions = Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 6")[0].n);
    const questions = await draftQuestions(admin, id);
    for (const question of questions.questions) {
      const removed = await admin.mutate("DELETE", `/api/admin/modules/${id}/questions/${question.id}?expectedDraftVersion=${questions.draftVersion}`);
      assert.equal(removed.status, 200, removed.text);
      questions.draftVersion = removed.json.data.draftVersion;
    }
    await saveDraft(admin, id, { title: "Judul Gagal" });
    const { version } = await loadDraft(admin, id);
    const reply = await publish(admin, id, version);
    assert.equal(reply.status, 422);
    assert.equal(reply.json.error.code, "publish_validation_failed");
    assert.ok(reply.json.error.details.errors.some((item) => item.code === "assessment_bank_empty"));
    assert.equal(rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title, liveTitle);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM quiz_questions WHERE module_number = 6")[0].n), liveQuestions, "the live bank is untouched");
  });
});

test("P21 a required module cannot change between quiz and no-quiz under the same policy", async () => {
  const { site } = await setup("p21");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 9);
    sql(site, "DELETE FROM quiz_questions WHERE module_number = 9");
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Ubah Mode" });
    const created = await admin.mutate("POST", `/api/admin/modules/${id}/questions`, {
      question: "Soal baru", options: ["A", "B"], correctIndex: 0, expectedDraftVersion: (await draftQuestions(admin, id)).draftVersion,
    });
    assert.equal(created.status, 201, created.text);
    const reply = await publish(admin, id, created.json.data.draftVersion);
    assert.equal(reply.status, 422);
    assert.ok(reply.json.error.details.errors.some((item) => item.code === "assessment_mode_locked"));
    void version;
  });
});

test("P10 two concurrent saves from the same version: one wins, one conflicts, nothing is silently lost", async () => {
  const { site } = await setup("p10");
  await withSite(site, async (api) => {
    await signIn(api.port, "peserta-a@example.test");
  });
  const id = moduleIdOf(site, 3);
  const actor = adminIdOf(site);
  const expected = Number(rows(site, "SELECT draft_version FROM module_drafts WHERE module_id = ?", [id])[0]?.draft_version ?? 1);
  // Ensure the draft row exists before the race, so both processes start from the same version.
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    await loadDraft(admin, id);
  });
  const base = Number(rows(site, "SELECT draft_version FROM module_drafts WHERE module_id = ?", [id])[0].draft_version);
  const [a, b] = await Promise.all([saveDraftProcess(site, id, base, actor, "Judul Race A"), saveDraftProcess(site, id, base, actor, "Judul Race B")]);
  const outcomes = [a, b].map((item) => item.out);
  const conflicts = outcomes.filter((text) => text.includes("revision_conflict")).length;
  const saved = outcomes.filter((text) => text.includes('"saved":true')).length;
  assert.equal(saved, 1, outcomes.join(" | ") + a.err + b.err);
  assert.equal(conflicts, 1, outcomes.join(" | "));
  const finalDraft = rows(site, "SELECT draft_version, content_payload_json FROM module_drafts WHERE module_id = ?", [id])[0];
  assert.equal(Number(finalDraft.draft_version), base + 1, "exactly one version step");
  const title = JSON.parse(finalDraft.content_payload_json).title;
  assert.ok(title === "Judul Race A" || title === "Judul Race B", "the winner's title is stored, not a mix");
  void expected;
});

test("P11 a repeated publish with the same version is refused and creates no second revision", async () => {
  const { site } = await setup("p11");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 4);
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Sekali" });
    const first = await publish(admin, id, version + 1);
    assert.equal(first.status, 200, first.text);
    const count = Number(rows(site, "SELECT COUNT(*) AS n FROM module_revisions WHERE module_id = ?", [id])[0].n);
    const again = await publish(admin, id, version + 1);
    assert.equal(again.status, 409);
    assert.equal(again.json.error.code, "revision_conflict");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_revisions WHERE module_id = ?", [id])[0].n), count);
  });
});

test("P26 a save with a stale version is refused with revision_conflict", async () => {
  const { site } = await setup("p26");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 5);
    const { version, payload } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Versi Baru" });
    const stale = await admin.mutate("PUT", `/api/admin/modules/${id}`, { ...payload, title: "Versi Lama", expectedDraftVersion: version });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.error.code, "revision_conflict");
    assert.equal(stale.json.error.details.currentDraftVersion, version + 1);
  });
});

test("P09 a failed publish leaves no partial publication", async () => {
  const { site } = await setup("p09");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 12);
    const liveTitle = rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title;
    const revisions = Number(rows(site, "SELECT COUNT(*) AS n FROM module_revisions WHERE module_id = ?", [id])[0].n);
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Gagal Terbit" });
    sql(site, "CREATE TRIGGER fail_publish BEFORE INSERT ON curriculum_publication_events WHEN NEW.event_type = 'module.published' BEGIN SELECT RAISE(ABORT, 'forced publish failure'); END");
    const reply = await publish(admin, id, version + 1);
    assert.equal(reply.status, 500, reply.text);
    assert.equal(rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title, liveTitle, "live lesson unchanged");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_revisions WHERE module_id = ?", [id])[0].n), revisions, "no revision was written");
    assert.equal(Number(rows(site, "SELECT draft_version AS v FROM module_drafts WHERE module_id = ?", [id])[0].v), version + 1, "draft pointer unchanged");
  });
});

test("P12 and P13 a historical revision stays readable and can only be copied into a new draft", async () => {
  const { site } = await setup("p12");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 13);
    const original = rows(site, "SELECT title FROM course_modules WHERE id = ?", [id])[0].title;
    const firstRevision = Number(rows(site, "SELECT id FROM module_revisions WHERE module_id = ? ORDER BY revision_number ASC LIMIT 1", [id])[0].id);
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Berubah" });
    await publish(admin, id, version + 1);
    const detail = await admin.get(`/api/admin/modules/${id}/revisions/${firstRevision}`);
    assert.equal(detail.json.data.payload.title, original, "the old revision keeps its content");
    assert.equal(detail.json.data.readOnly, true);
    const draftVersion = (await loadDraft(admin, id)).version;
    const copied = await admin.mutate("POST", `/api/admin/modules/${id}/revisions/${firstRevision}/copy-to-draft`, { expectedDraftVersion: draftVersion });
    assert.equal(copied.status, 200, copied.text);
    assert.equal(copied.json.data.module.draftPayload.title, original, "copied into the draft");
    assert.equal((await admin.get(`/api/admin/modules/${id}/revisions/${firstRevision}`)).json.data.payload.title, original, "the revision itself is unchanged");
  });
});

test("P14, P15 and P24 a question edit stays in the draft; learners never see it or any answer key", async () => {
  const { site } = await setup("p14");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const id = moduleIdOf(site, 10);
    const live = rows(site, "SELECT id, question FROM quiz_questions WHERE module_number = 10 ORDER BY id ASC")[0];
    const drafts = await draftQuestions(admin, id);
    const edited = await admin.mutate("PUT", `/api/admin/modules/${id}/questions/${live.id}`, {
      question: "Pertanyaan draf rahasia", options: ["Satu", "Dua", "Tiga"], correctIndex: 2, expectedDraftVersion: drafts.draftVersion,
    });
    assert.equal(edited.status, 200, edited.text);
    assert.equal(rows(site, "SELECT question FROM quiz_questions WHERE id = ?", [live.id])[0].question, live.question, "the published bank is untouched");
    const quiz = await learner.get("/api/quiz?moduleNumber=10");
    assert.ok(!quiz.text.includes("Pertanyaan draf rahasia"), "learners never receive a draft question");
    assert.ok(!quiz.text.includes("correctIndex"), "no answer key in the learner projection");
  });
});

test("P16 and P17 a published bank change applies to new attempts; an open attempt keeps its original snapshot", async () => {
  const { site } = await setup("p16");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const id = moduleIdOf(site, 11);
    const open = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 11, requestKey: randomUUID() })).json.data.attempt;
    const originalText = open.questions[0].question;
    const entry = attemptKey(site, open.id).get(open.questions[0].id);

    const drafts = await draftQuestions(admin, id);
    const live = rows(site, "SELECT id FROM quiz_questions WHERE module_number = 11 ORDER BY id ASC")[0];
    await admin.mutate("PUT", `/api/admin/modules/${id}/questions/${live.id}`, {
      question: "Soal yang diterbitkan", options: ["X", "Y"], correctIndex: 1, expectedDraftVersion: drafts.draftVersion,
    });
    const { version } = await loadDraft(admin, id);
    const latest = await draftQuestions(admin, id);
    const published = await publish(admin, id, latest.draftVersion);
    assert.equal(published.status, 200, published.text);

    const stillOpen = await learner.get(`/api/assessments/attempts/${open.id}`);
    assert.equal(stillOpen.json.data.attempt.questions[0].question, originalText, "the open attempt keeps its snapshot");
    const answered = await learner.mutate("POST", `/api/assessments/attempts/${open.id}/answers`, { questionId: open.questions[0].id, answerIndex: entry.correct });
    assert.equal(answered.json.data.feedback.isCorrect, true, "grading uses the original key");
    // A started attempt is resumed until it ends; the new bank applies once the old attempt is submitted.
    const closed = await learner.mutate("POST", `/api/assessments/attempts/${open.id}/submit`, { requestKey: randomUUID() });
    assert.equal(closed.status, 200, closed.text);
    const fresh = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 11, requestKey: randomUUID() })).json.data.attempt;
    assert.equal(fresh.questions[0].question, "Soal yang diterbitkan", "a new attempt uses the published bank");
    void version;
  });
});

test("P18 and P19 a submitted attempt and a completed module survive later publications", async () => {
  const { site } = await setup("p18");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const passed = await passModule(learner, site, 7);
    assert.equal(passed.result.passed, true);
    const id = moduleIdOf(site, 7);
    const { version } = await loadDraft(admin, id);
    await saveDraft(admin, id, { title: "Judul Setelah Lulus" });
    assert.equal((await publish(admin, id, version + 1)).status, 200);
    assert.equal((await progressRow(learner, 7)).completed, true, "completion survives a content revision");
    const history = await learner.get(`/api/assessments/attempts/${passed.id}`);
    assert.equal(history.json.data.attempt.result.passed, true, "the submitted attempt is unchanged");
  });
});

test("P23 a draft question with an invalid answer index is refused", async () => {
  const { site } = await setup("p23");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 14);
    const drafts = await draftQuestions(admin, id);
    const reply = await admin.mutate("POST", `/api/admin/modules/${id}/questions`, {
      question: "Soal salah", options: ["A", "B"], correctIndex: 9, expectedDraftVersion: drafts.draftVersion,
    });
    assert.equal(reply.status, 422);
    assert.equal(reply.json.error.code, "validation_error");
  });
});

/* ------------------------------------------------------------ archive and delete */

test("P28, P29 and P32 archiving keeps history; a v1-required archived module stays available; restore changes nothing historical", async () => {
  const { site } = await setup("p28");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 8);
    const id = moduleIdOf(site, 8);
    const attempts = Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE module_number = 8")[0].n);
    const events = Number(rows(site, "SELECT COUNT(*) AS n FROM module_learning_events WHERE module_number = 8")[0].n);
    const archived = await admin.mutate("POST", `/api/admin/modules/${id}/archive`, { reason: "Materi diganti oleh revisi kurikulum", confirm: true });
    assert.equal(archived.status, 200, archived.text);
    assert.equal(rows(site, "SELECT lifecycle_status AS s FROM course_modules WHERE id = ?", [id])[0].s, "archived");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE module_number = 8")[0].n), attempts, "attempts remain");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_learning_events WHERE module_number = 8")[0].n), events, "events remain");
    assert.equal((await learner.get("/api/modules")).json.data.some((item) => item.moduleNumber === 8), true, "required by the learner's policy, so still visible");
    assert.equal((await learner.get("/api/quiz?moduleNumber=8")).json.data.length > 0, true, "its quiz is still reachable");
    const deleteAttempt = await admin.mutate("DELETE", `/api/admin/modules/${id}`);
    assert.equal(deleteAttempt.status, 409);
    assert.equal(deleteAttempt.json.error.code, "module_has_academic_history", "P30: history blocks deletion");
    const restored = await admin.mutate("POST", `/api/admin/modules/${id}/restore`, { confirm: true });
    assert.equal(restored.status, 200, restored.text);
    assert.equal(rows(site, "SELECT lifecycle_status AS s FROM course_modules WHERE id = ?", [id])[0].s, "active");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE module_number = 8")[0].n), attempts);
  });
});

test("P31 an unpublished draft-only module with no history can be deleted; its number is not reused", async () => {
  const { site } = await setup("p31");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const levelName = rows(site, "SELECT level_name FROM course_modules WHERE level_number = 1 LIMIT 1")[0].level_name;
    const created = await admin.mutate("POST", "/api/admin/modules", { levelNumber: 1, levelName, moduleNumber: 201, title: "Sementara", content: "x", learningObjectives: [], keyTakeaways: [], checklist: [] });
    const id = created.json.data.module.id;
    const removed = await admin.mutate("DELETE", `/api/admin/modules/${id}`);
    assert.equal(removed.status, 200, removed.text);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM course_modules WHERE module_number = 201")[0].n), 0);
    const reuse = await admin.mutate("POST", "/api/admin/modules", { levelNumber: 1, levelName, moduleNumber: 201, title: "Ulang", content: "x", learningObjectives: [], keyTakeaways: [], checklist: [] });
    assert.equal(reuse.json.error.code, "module_number_exists");
  });
});

test("P33 and P34 uploads referenced by a historical revision or by a draft are in the reference set", async () => {
  const { site } = await setup("p33");
  await withSite(site, async (api) => {
    await signIn(api.port, "peserta-a@example.test");
  });
  const result = spawnSync("php", [...SQLITE, join(repo, "tests", "fixtures", "q05", "media-references.php"), String(moduleIdOf(site, 15))], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const reference = JSON.parse(result.stdout.trim());
  assert.equal(reference.historicKept, true, "P33: a historical published revision keeps its upload referenced");
  assert.equal(reference.draftKept, true, "P34: a draft keeps its upload referenced");
  assert.equal(reference.unreferencedKept, false, "an unreferenced upload is not protected");
});

test("P36 creating a v2 draft leaves v1 untouched", async () => {
  const { site } = await setup("p36");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const before = JSON.stringify(rows(site, "SELECT * FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'"));
    const beforeTiers = JSON.stringify(rows(site, "SELECT * FROM certificate_tier_policies WHERE policy_version = 'academy-v1' ORDER BY tier_number"));
    const created = await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.data.policy.status, "draft");
    assert.equal(JSON.stringify(rows(site, "SELECT * FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'")), before);
    assert.equal(JSON.stringify(rows(site, "SELECT * FROM certificate_tier_policies WHERE policy_version = 'academy-v1' ORDER BY tier_number")), beforeTiers);
  });
});

function v2Body(overrides = {}) {
  const modules = Array.from({ length: 22 }, (_, index) => ({ moduleNumber: index + 1, required: true }));
  return {
    modules,
    modulePassPercent: 70,
    finalPassPercent: 80,
    tiers: [
      { tierNumber: 1, tierName: "Layer Poultry Farm Foundation", modules: [1, 2, 3], requiresFinal: false },
      { tierNumber: 2, tierName: "Layer Farm Operator", modules: [4, 5], requiresFinal: false },
      { tierNumber: 3, tierName: "Layer Farm Supervisor", modules: [6, 7, 8, 11, 12, 13, 15, 16, 17], requiresFinal: false },
      { tierNumber: 4, tierName: "Layer Farm Manager", modules: [9, 10, 14, 18], requiresFinal: false },
      { tierNumber: 5, tierName: "Advanced Layer Farm Management", modules: [19, 20, 21], requiresFinal: false },
      { tierNumber: 6, tierName: "Layer Poultry Farm Expert", modules: [22], requiresFinal: true },
    ],
    ...overrides,
  };
}

test("P37 and P38 an invalid v2 module requirement and an invalid tier mapping are rejected", async () => {
  const { site } = await setup("p37");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" });
    const badModule = v2Body({ modules: [...v2Body().modules, { moduleNumber: 999, required: true }] });
    assert.equal((await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", badModule)).status, 200);
    const badModuleValidation = await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/validate", {});
    assert.equal(badModuleValidation.json.data.valid, false);
    assert.ok(badModuleValidation.json.data.errors.some((item) => item.code === "module_missing"));

    const badTier = v2Body();
    badTier.tiers[0].modules = [1, 2, 3, 22];
    badTier.modules = badTier.modules.map((entry) => (entry.moduleNumber === 22 ? { moduleNumber: 22, required: false } : entry));
    await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", badTier);
    const tierValidation = await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/validate", {});
    assert.equal(tierValidation.json.data.valid, false);
    assert.ok(tierValidation.json.data.errors.some((item) => item.code === "tier_module_not_required"));
  });
});

test("P39 a valid v2 policy validates and becomes ready", async () => {
  const { site } = await setup("p39");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" });
    await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", v2Body({ modulePassPercent: 75 }));
    const validated = await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/validate", {});
    assert.equal(validated.json.data.valid, true, JSON.stringify(validated.json.data.errors));
    const ready = await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/ready", {});
    assert.equal(ready.status, 200, ready.text);
    assert.equal(ready.json.data.policy.status, "ready");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM curriculum_policy_versions WHERE status = 'active'")[0].n), 1, "readiness does not activate");
  });
});

test("P40, P41, P43 and P44 activation affects new accounts only; existing learners and certificates keep their policy", async () => {
  const { site } = await setup("p40");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    assert.equal((await learner.mutate("POST", "/api/certificates/claims", { tierNumber: 1, requestKey: randomUUID() })).status, 201);
    const publicId = rows(site, "SELECT public_id FROM certificate_issuances WHERE user_id = (SELECT id FROM users WHERE email = 'peserta-a@example.test')")[0].public_id;
    await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" });
    await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", v2Body({ modulePassPercent: 75 }));
    await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/validate", {});
    await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/ready", {});

    const dry = cli(site, ["--policy-version=academy-v2", "--expect-environment=local", "--dry-run"]);
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.equal(JSON.parse(dry.stdout).changed, false);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM curriculum_policy_versions WHERE status = 'active' AND policy_version = 'academy-v1'")[0].n), 1, "dry-run changes nothing");

    const refused = cli(site, ["--policy-version=academy-v2", "--expect-environment=local", "--apply"]);
    assert.equal(refused.status, 2, "apply needs an operator and evidence");
    const wrongEnvironment = cli(site, ["--policy-version=academy-v2", "--expect-environment=production", "--apply", "--operator=Uji", "--evidence-ref=UJI-1"]);
    assert.equal(wrongEnvironment.status, 3, "an unintended environment is refused");

    const applied = cli(site, ["--policy-version=academy-v2", "--expect-environment=local", "--apply", "--operator=Operator Uji", "--evidence-ref=UJI-1"]);
    assert.equal(applied.status, 0, applied.stdout + applied.stderr);
    assert.equal(JSON.parse(applied.stdout).activated, "academy-v2");
    assert.equal(rows(site, "SELECT status FROM curriculum_policy_versions WHERE policy_version = 'academy-v2'")[0].status, "active");
    assert.equal(rows(site, "SELECT status FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'")[0].status, "superseded");

    const existing = await learner.get("/api/curriculum/me");
    assert.equal(existing.json.data.policyVersion, "academy-v1", "P41: the existing learner stays on v1");
    const reset = await admin.mutate("DELETE", `/api/admin/users/${Number(rows(site, "SELECT id FROM users WHERE email = 'peserta-a@example.test'")[0].id)}/progress`, { confirm: true });
    assert.equal(reset.status, 200, reset.text);
    assert.equal((await learner.get("/api/curriculum/me")).json.data.policyVersion, "academy-v1", "P43: a progress reset keeps the policy");
    const verify = await api.get(`/api/public/certificates/verify/${publicId}`);
    assert.equal(verify.json.data.valid, true, "P44: an issued certificate stays valid");

    const newcomer = await api.mutate("POST", "/api/auth/register", { email: "baru@example.test", password: "Valid-pass1", fullName: "Peserta Baru" });
    assert.equal(newcomer.status, 202, newcomer.text);
    const newId = Number(rows(site, "SELECT id FROM users WHERE email = 'baru@example.test'")[0].id);
    assert.equal(rows(site, "SELECT policy_version FROM learner_curriculum_assignments WHERE user_id = ?", [newId])[0].policy_version, "academy-v2", "P40: new accounts receive the activated policy");
  });
});

test("P47 concurrent activations leave exactly one active policy", async () => {
  const { site } = await setup("p47");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    for (const version of ["academy-v2", "academy-v3"]) {
      await admin.mutate("POST", "/api/admin/curriculum/policies", { version });
      await admin.mutate("PUT", `/api/admin/curriculum/policies/${version}`, v2Body({ modulePassPercent: 72 }));
      await admin.mutate("POST", `/api/admin/curriculum/policies/${version}/validate`, {});
      await admin.mutate("POST", `/api/admin/curriculum/policies/${version}/ready`, {});
    }
  });
  const args = (version) => [`--policy-version=${version}`, "--expect-environment=local", "--apply", "--operator=Uji", "--evidence-ref=RACE"];
  const [a, b] = await Promise.all([cliProcess(site, args("academy-v2")), cliProcess(site, args("academy-v3"))]);
  assert.ok(a.code === 0 || b.code === 0, a.err + b.err);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM curriculum_policy_versions WHERE status = 'active'")[0].n), 1, "one active policy");
});

test("P46 a chapter reorder through the live catalogue is refused; the order is unchanged", async () => {
  const { site } = await setup("p46");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const before = JSON.stringify(rows(site, "SELECT id, sort_order FROM course_modules ORDER BY id"));
    const reply = await admin.mutate("PUT", "/api/admin/modules/reorder", { items: [] });
    assert.equal(reply.status, 409);
    assert.equal(reply.json.error.code, "curriculum_structure_draft_required");
    assert.equal(JSON.stringify(rows(site, "SELECT id, sort_order FROM course_modules ORDER BY id")), before);
  });
});

test("P48 and P49 publishing without the right role or without CSRF is refused", async () => {
  const { site } = await setup("p48");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const admin = await signIn(api.port, "pengelola@example.test");
    const id = moduleIdOf(site, 2);
    const learnerTry = await learner.mutate("POST", `/api/admin/modules/${id}/publish`, { expectedDraftVersion: 1, confirm: true });
    assert.equal(learnerTry.status, 403, "a learner cannot publish");
    const noCsrf = await admin.raw("POST", `/api/admin/modules/${id}/publish`, { expectedDraftVersion: 1, confirm: true });
    assert.equal(noCsrf.status, 419, "publishing needs CSRF");
  });
});

/* ------------------------------------------------------------- not run here */

test("P25 the final-exam bank cannot be revised while an attempt is active", { skip: "NOT_TESTED: the final-exam bank draft and publish routes are not implemented in Q05" }, () => {});
test("P27 APPI drafting cannot publish", { skip: "NOT_TESTED: the APPI model is external; only its absence of a publish path is checked by source review" }, () => {});
test("P53 and P54 mobile and desktop editor publication workflows", { skip: "NOT_TESTED: no browser run was executed for Q05" }, () => {});
test("P55 MySQL concurrent publication and activation", { skip: "NOT_TESTED: no disposable MySQL server in this environment" }, () => {});
