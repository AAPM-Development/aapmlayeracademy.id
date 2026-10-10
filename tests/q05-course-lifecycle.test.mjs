import { after, test } from "node:test";
import assert from "node:assert/strict";
import { cleanup, setup, signIn, withSite, rows, passModule } from "./helpers/site.mjs";

after(cleanup);

test("course admin projection follows drafts, question changes, archive and restore without rewriting learner evidence", async () => {
  const { site } = await setup("q05-course-lifecycle");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 2);
    const coursePath = "/api/admin/courses/layer-farm-management";
    const before = (await learner.get("/api/modules")).json.data;
    const original = before.find((item) => item.moduleNumber === 2);
    const id = Number(rows(site, "SELECT id FROM course_modules WHERE module_number = 2")[0].id);
    const evidence = () => JSON.stringify([
      rows(site, "SELECT id, module_id, revision_number, content_payload_json FROM module_revisions ORDER BY id"),
      rows(site, "SELECT * FROM assessment_attempts ORDER BY id"),
      rows(site, "SELECT * FROM assessment_attempt_items ORDER BY id"),
      rows(site, "SELECT * FROM user_progress ORDER BY id"),
      rows(site, "SELECT * FROM certificates ORDER BY id"),
      rows(site, "SELECT * FROM learner_curriculum_assignments ORDER BY user_id"),
      rows(site, "SELECT * FROM module_learning_events ORDER BY id"),
      rows(site, "SELECT * FROM question_bank_revisions ORDER BY id"),
      rows(site, "SELECT * FROM question_bank_revision_items ORDER BY id"),
    ]);
    const savedEvidence = evidence();
    const draftsBeforeList = rows(site, "SELECT COUNT(*) AS n FROM module_drafts")[0].n;
    const initial = await admin.get(coursePath);
    assert.equal(initial.status, 200, initial.text);
    assert.deepEqual(initial.json.data.lifecycleCounts, { draft: 0, published: 22, unpublished: 0, archived: 0 });
    assert.equal(initial.json.data.capabilities.reorder, false);
    assert.equal(rows(site, "SELECT COUNT(*) AS n FROM module_drafts")[0].n, draftsBeforeList, "listing never creates editorial drafts");
    const view = (await admin.get(`/api/admin/modules/${id}?view=draft`)).json.data;
    const payload = { ...view.module.draftPayload, title: "Judul editorial terbaru" };
    for (const key of ["learningObjectives", "keyTakeaways", "checklist"]) payload[key] = JSON.parse(payload[key] || "[]");
    const saved = await admin.mutate("PUT", `/api/admin/modules/${id}`, { ...payload, expectedDraftVersion: view.draft.version });
    assert.equal(saved.status, 200, saved.text);
    const created = await admin.mutate("POST", "/api/admin/modules", { ...payload, title: "Modul draf baru", moduleNumber: 200 });
    assert.equal(created.status, 201, created.text);
    assert.equal((await admin.mutate("POST", `/api/admin/modules/${created.json.data.module.id}/archive`, { reason: "Belum diterbitkan", confirm: true })).json.error.code, "module_not_active");
    const detail = (await admin.get(coursePath)).json.data;
    const projected = detail.curriculum.flatMap((level) => level.modules).find((item) => item.id === id);
    assert.equal(projected.title, payload.title);
    assert.equal(projected.publishedTitle, original.title);
    assert.equal(projected.lifecycleStatus, "active");
    assert.equal(projected.publishedRevisionId, view.publishedRevisionId);
    assert.equal(projected.draft.hasUnpublishedChanges, true);
    assert.equal(projected.draft.version, view.draft.version + 1);
    assert.equal(Object.hasOwn(projected, "questions"), false, "course rows do not expose question payloads");
    assert.deepEqual(detail.lifecycleCounts, { draft: 1, published: 22, unpublished: 1, archived: 0 });
    assert.equal((await learner.get("/api/modules")).json.data.find((item) => item.moduleNumber === 2).title, original.title);
    assert.equal((await learner.get("/api/modules")).json.data.some((item) => item.moduleNumber === 200), false);
    // A question-only draft also contributes to the unpublished count.
    const thirdId = Number(rows(site, "SELECT id FROM course_modules WHERE module_number = 3")[0].id);
    const third = (await admin.get(`/api/admin/modules/${thirdId}?view=draft`)).json.data;
    const changedQuestion = await admin.mutate("POST", `/api/admin/modules/${thirdId}/questions`, { question: "Pertanyaan draf baru", options: ["A", "B"], correctIndex: 0, expectedDraftVersion: third.draft.version });
    assert.equal(changedQuestion.status, 201, changedQuestion.text);
    assert.equal((await admin.get(coursePath)).json.data.lifecycleCounts.unpublished, 2);
    for (const [path, body, reason] of [["/api/admin/modules/reorder", { items: [id] }, /draf kebijakan/], ["/api/admin/chapters/1", { levelName: "Nama langsung" }, /draf modul/]]) {
      const blocked = await admin.mutate("PUT", path, body);
      assert.equal(blocked.status, 409);
      assert.equal(blocked.json.error.code, "curriculum_structure_draft_required");
      assert.match(blocked.json.error.message, reason);
    }
    const archiveBody = { reason: "Materi sedang ditinjau", confirm: true };
    assert.equal((await learner.mutate("POST", `/api/admin/modules/${id}/archive`, archiveBody)).status, 403);
    assert.equal((await admin.raw("POST", `/api/admin/modules/${id}/archive`, archiveBody)).status, 419, "CSRF is required");
    assert.equal((await admin.mutate("POST", `/api/admin/modules/${id}/archive`, { reason: "x", confirm: true })).json.error.code, "reason_required");
    const archived = await admin.mutate("POST", `/api/admin/modules/${id}/archive`, archiveBody);
    assert.equal(archived.status, 200, archived.text);
    const archivedCourse = (await admin.get(coursePath)).json.data;
    assert.deepEqual(archivedCourse.lifecycleCounts, { draft: 1, published: 21, unpublished: 2, archived: 1 });
    const archivedModule = archivedCourse.curriculum.flatMap((level) => level.modules).find((item) => item.id === id);
    assert.equal(archivedModule.lifecycleStatus, "archived");
    assert.equal(archivedModule.archiveReason, "Materi sedang ditinjau");
    assert.equal((await learner.get("/api/modules")).json.data.find((item) => item.moduleNumber === 2).title, original.title, "v1 required modules stay available to assigned learners");
    const restored = await admin.mutate("POST", `/api/admin/modules/${id}/restore`, {});
    assert.equal(restored.status, 200, restored.text);
    assert.equal((await admin.get(coursePath)).json.data.lifecycleCounts.archived, 0);
    assert.equal(evidence(), savedEvidence, "immutable revisions, answered attempt, grade and progress stay unchanged");
    assert.deepEqual((await learner.get("/api/modules")).json.data, before);
    const list = (await admin.get("/api/admin/courses")).json.data;
    assert.deepEqual(list.courses[0].lifecycleCounts, (await admin.get(coursePath)).json.data.lifecycleCounts);
    assert.equal((await learner.get(coursePath)).status, 403);
  });
});
