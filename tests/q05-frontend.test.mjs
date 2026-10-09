import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nativeApi } from "../src/api/nativeClient.js";
import { curriculumModule, recoverCurriculumDraft, canPublishCurriculumDraft } from "../src/lib/curriculumEditorState.js";
import { reconcileSavedModule } from "../src/lib/editorSaveState.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("draft and question writes carry the shared expected version; publication is explicit", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return { ok: true, json: async () => ({ data: path.endsWith("/csrf") ? { csrfToken: "test-token" } : { draft: { version: 8 } } }) };
  };
  try {
    await nativeApi.admin.modules.saveDraft(12, { title: "Draf" }, 7);
    await nativeApi.admin.modules.createQuestion(12, { question: "Soal" }, 8);
    await nativeApi.admin.modules.updateQuestion(12, -1, { question: "Koreksi" }, 9);
    await nativeApi.admin.modules.deleteQuestion(12, -1, 10);
    await nativeApi.admin.modules.publishDraft(12, 11);
    await nativeApi.admin.modules.copyRevisionToDraft(12, 3, 12);
    await nativeApi.admin.modules.archive(12, "Konten usang");
    const writes = calls.filter((call) => call.body).map((call) => JSON.parse(call.body));
    assert.deepEqual(writes.slice(0, 6).map((body) => body.expectedDraftVersion), [7, 8, 9, 10, 11, 12]);
    assert.equal(writes[4].confirm, true);
    assert.equal(writes[6].confirm, true);
    assert.equal(writes[6].reason, "Konten usang");
    assert.equal(calls.find((call) => call.method === "DELETE").path, "/api/admin/modules/12/questions/-1");
  } finally { globalThis.fetch = original; }
});

test("editor reads draft view and exposes distinct Indonesian actions with conflict recovery", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (path) => { seen = path; return { ok: true, json: async () => ({ data: {} }) }; };
  try { await nativeApi.admin.modules.detail(12, "draft"); assert.equal(seen, "/api/admin/modules/12?view=draft"); }
  finally { globalThis.fetch = original; }
  assert.match(read("src/components/admin/EditorActionBar.jsx"), /\}Simpan draf\s/);
  const editor = read("src/pages/admin/AdminModuleEditor.jsx");
  assert.match(editor, /revision_conflict/);
  assert.match(editor, /Muat ulang draf terbaru/);
  assert.match(editor, /Pertahankan perubahan saya/);
  assert.doesNotMatch(editor, /Perubahan langsung dipakai/);
  const appi = editor.slice(editor.indexOf("const applyCompanionDraft"), editor.indexOf("if (isLoading", editor.indexOf("const applyCompanionDraft")));
  assert.doesNotMatch(appi, /publishDraft|publishPreview/);
});

test("conflict recovery preserves the full current form by choice and never merges remote fields", () => {
  const local = { title: "Perubahan saya", content: "Materi lokal", editorialContent: { blocks: [{ type: "text", text: "Isi" }] } };
  const latest = { title: "Editor lain", content: "Isi server", editorialContent: null };
  const savedBrowser = JSON.stringify(local);
  assert.deepEqual(recoverCurriculumDraft(local, latest, 9, true), { form: local, draftVersion: 9 });
  assert.deepEqual(recoverCurriculumDraft(local, latest, 9, false), { form: latest, draftVersion: 9 });
  assert.equal(JSON.stringify(local), savedBrowser);
  assert.equal(recoverCurriculumDraft(local, latest, 9, true).form, local);
});

test("publication needs valid review and validation at exactly the shared current version", () => {
  const ready = { validation: { valid: true, draftVersion: 9 }, review: { valid: true, draftVersion: 9 }, draftVersion: 9 };
  assert.equal(canPublishCurriculumDraft(ready), true);
  for (const delta of [{ dirty: true }, { conflict: {} }, { archived: true }, { draftVersion: 10 }, { review: { valid: false, draftVersion: 9 } }, { validation: null }]) {
    assert.equal(canPublishCurriculumDraft({ ...ready, ...delta }), false);
  }
});

test("draft and old immutable payloads parse JSON lists, blocks, chapter and ordering consistently", () => {
  const payload = { title: "Judul draft", learningObjectives: '["Tujuan"]', keyTakeaways: '["Poin"]', checklist: '["Cek"]',
    editorialContent: '{"version":1,"blocks":[]}', levelNumber: 3, sortOrder: 8 };
  const draft = curriculumModule({ module: { title: "Judul lama", draftPayload: payload }, draft: { version: 4 } });
  const revision = curriculumModule({ payload });
  for (const module of [draft, revision]) {
    assert.equal(module.title, "Judul draft"); assert.deepEqual(module.learningObjectives, ["Tujuan"]);
    assert.deepEqual(module.editorialContent, { version: 1, blocks: [] }); assert.equal(module.level, 3); assert.equal(module.order, 8);
  }
  assert.deepEqual(curriculumModule({ payload: { learningObjectives: "invalid" } }).learningObjectives, []);
});

test("successful draft response keeps edits typed after submission", () => {
  const submitted = { title: "Draf", content: "Isi" };
  const current = { title: "Draf berikutnya", content: "Isi" };
  assert.deepEqual(reconcileSavedModule(submitted, current, { title: "Draf", content: "Isi normal" }), { title: "Draf berikutnya", content: "Isi normal" });
});

test("preview, validation, review, revisions and restore use their dedicated backend routes", async () => {
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (path) => { paths.push(path); return { ok: true, json: async () => ({ data: {} }) }; };
  try {
    await nativeApi.admin.modules.previewDraft(12); await nativeApi.admin.modules.validateDraft(12);
    await nativeApi.admin.modules.publishPreview(12); await nativeApi.admin.modules.revisions(12);
    await nativeApi.admin.modules.revision(12, 3); await nativeApi.admin.modules.restore(12);
    assert.deepEqual(paths, ["preview", "validate", "publish-preview", "revisions", "revisions/3", "restore"].map((suffix) => `/api/admin/modules/12/${suffix}`));
  } finally { globalThis.fetch = original; }
  const panel = read("src/components/admin/CurriculumPublishingPanel.jsx");
  for (const label of ["Validasi", "Terbitkan", "Arsipkan"]) assert.match(panel, new RegExp(`>${label}<`));
  assert.match(panel, /canPublishCurriculumDraft/);
  assert.match(panel, /Ya, terbitkan/);
  assert.doesNotMatch(read("src/pages/admin/AdminModuleEditor.jsx"), /purgeProgress|Hapus bersama progress/);
});

test("API errors preserve structured validation and conflict details", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: { code: "revision_conflict", message: "Draf berubah", details: { currentDraftVersion: 9 } } }) });
  try { await assert.rejects(nativeApi.admin.modules.previewDraft(12), (error) => error.code === "revision_conflict" && error.details.currentDraftVersion === 9); }
  finally { globalThis.fetch = original; }
});
