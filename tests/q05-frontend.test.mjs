import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nativeApi } from "../src/api/nativeClient.js";
import { curriculumModule, recoverCurriculumDraft, canPublishCurriculumDraft } from "../src/lib/curriculumEditorState.js";
import { reconcileSavedModule } from "../src/lib/editorSaveState.js";

test("course lifecycle labels distinguish draft, published, pending changes and archive", async () => {
  const { moduleLifecycleLabels, curriculumStructureRecovery } = await import("../src/lib/curriculumState.js");
  assert.deepEqual(moduleLifecycleLabels({ lifecycleStatus: "draft" }).map((item) => item.label), ["Draf"]);
  assert.deepEqual(moduleLifecycleLabels({ lifecycleStatus: "draft", draft: { hasUnpublishedChanges: true } }).map((item) => item.label), ["Draf"]);
  assert.deepEqual(moduleLifecycleLabels({ lifecycleStatus: "active", publishedRevisionId: 1 }).map((item) => item.label), ["Terbit"]);
  assert.deepEqual(moduleLifecycleLabels({ lifecycleStatus: "active", publishedRevisionId: 1, draft: { hasUnpublishedChanges: true } }).map((item) => item.label), ["Terbit", "Perubahan belum terbit"]);
  assert.deepEqual(moduleLifecycleLabels({ lifecycleStatus: "archived", publishedRevisionId: 1, draft: { hasUnpublishedChanges: true } }).map((item) => item.label), ["Arsip", "Perubahan belum terbit"]);
  const blocked = { code: "curriculum_structure_draft_required", message: "Nama chapter diubah melalui draf modul." };
  assert.deepEqual(curriculumStructureRecovery(blocked, "/admin/courses/academy-native/modules/12"), { message: blocked.message, to: "/admin/courses/academy-native/modules/12", label: "Buka draf modul" });
  assert.equal(curriculumStructureRecovery(blocked).to, "/admin/curriculum/policies");
  const detail = read("src/pages/admin/AdminCourseDetail.jsx");
  assert.doesNotMatch(detail, /purgeProgress|Hapus bersama progres|DragDropContext|Naikkan urutan|ChapterRenameDialog|persistOrder/);
  assert.match(detail, /Kebijakan kurikulum/);
  assert.match(detail, /Bank ujian akhir/);
  assert.match(detail, /Edit draf/);
  assert.match(detail, /Ya, arsipkan/);
  assert.match(detail, /Ya, pulihkan/);
  assert.match(detail, /Alasan pengarsipan/);
  assert.match(read("src/lib/useAdminData.js"), /nativeApi\.admin\.modules\.archive/);
  assert.match(read("src/lib/useAdminData.js"), /nativeApi\.admin\.modules\.restore/);
});

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("curriculum phone actions clear the retained shell navigation and policy controls reserve full selector width", async () => {
  const { default: postcss } = await import("postcss");
  const result = await postcss([]).process(read("src/styles/features/curriculum.css"), { from: undefined });
  const mobileRules = [];
  result.root.walkRules((rule) => {
    if (rule.parent.type === "atrule" && rule.parent.params === "(max-width: 859px)") mobileRules.push(rule);
  });
  const declarations = (selector) => Object.fromEntries(mobileRules.find((rule) => rule.selector === selector).nodes.map(({ prop, value }) => [prop, value]));
  const bar = declarations(".aapm-curriculum-actionbar");
  assert.equal(bar.position, "fixed", "primary action is visible before scrolling to the final form row");
  assert.match(bar.bottom, /var\(--aapm-component-bottom-nav-height\).*env\(safe-area-inset-bottom\)/, "bar clears the actual shell height plus device safe area");
  assert.equal(declarations(".aapm-curriculum-actionbar__desktop").display, "none", "the phone bar cannot wrap the complete desktop action group into a tall stack");
  assert.equal(declarations(".aapm-curriculum-actionbar__mobile").display, "flex");
  const touchTarget = declarations(".aapm-curriculum-actionbar__mobile :is(.aapm-button, .aapm-icon-button)");
  assert.equal(touchTarget["min-height"], "44px");
  assert.equal(touchTarget["min-width"], "44px");
  assert.equal(declarations(".aapm-page > .aapm-curriculum-editor").animation, "none", "entrance transforms cannot anchor the fixed action bar to the form");
  assert.ok(declarations(".aapm-curriculum-editor")["padding-bottom"], "last form controls can scroll clear of the fixed action bar");
  let selectorGrid;
  result.root.walkRules((rule) => {
    if (rule.selector === ".aapm-curriculum-policy-controls" && rule.parent.params === "(max-width: 639px)") selectorGrid = rule;
  });
  assert.equal(selectorGrid.nodes.find((node) => node.prop === "grid-template-columns").value, "minmax(0, 1fr)");
});

test("deferred archive failure retains its retry reason and a successful retry clears stale feedback", async () => {
  const { runCurriculumLifecycleMutation } = await import("../src/lib/curriculumState.js");
  let error = null;
  const reason = "Materi sedang ditinjau";
  const calls = [];
  let rejectFirst;
  const firstMutation = new Promise((_, reject) => { rejectFirst = reject; });
  const updateFeedback = (next) => { error = next; };
  const first = runCurriculumLifecycleMutation(() => { calls.push(reason); return firstMutation; }, updateFeedback);
  assert.equal(error, null);
  const failure = new Error("Jaringan terputus");
  rejectFirst(failure);
  await assert.rejects(first, /Jaringan terputus/);
  assert.equal(error, failure);
  assert.equal(reason, "Materi sedang ditinjau");
  let resolveRetry;
  const retryMutation = new Promise((resolve) => { resolveRetry = resolve; });
  const retry = runCurriculumLifecycleMutation(() => { calls.push(reason); return retryMutation; }, updateFeedback);
  assert.equal(error, null, "old failure disappears while retry is pending");
  resolveRetry({ lifecycleStatus: "archived" });
  assert.deepEqual(await retry, { lifecycleStatus: "archived" });
  assert.equal(error, null, "successful retry leaves no stale page/dialog alert");
  assert.deepEqual(calls, [reason, reason], "retry submits the preserved reason");
});

test("course phone grid and stacked alert actions compile to scoped responsive CSS", async () => {
  const [{ default: postcss }, { default: tailwind }] = await Promise.all([import("postcss"), import("tailwindcss")]);
  const result = await postcss([tailwind({
    content: [{ raw: read("src/pages/admin/AdminCourseDetail.jsx"), extension: "jsx" }],
  })]).process("@tailwind utilities;", { from: undefined });
  const responsive = [];
  result.root.walkRules((rule) => {
    if (rule.parent.type === "atrule" && rule.parent.name === "media" && rule.parent.params.includes("640px")) responsive.push(rule);
  });
  const hasDeclaration = (rule, prop, value) => rule.nodes.some((node) => node.prop === prop && node.value === value);
  const phoneGrid = responsive.find((rule) => rule.selector.includes("grid-cols") && hasDeclaration(rule, "grid-template-columns", "auto minmax(0,1fr)"));
  assert.ok(phoneGrid, "phone two-column layout is generated at the sm breakpoint");
  assert.ok(phoneGrid.nodes.find((node) => node.prop === "grid-template-columns").important, "phone grid overrides the existing course selector while desktop remains unchanged");
  assert.ok(responsive.some((rule) => rule.selector.includes("last-child") && hasDeclaration(rule, "grid-column-start", "2")), "alert action moves beneath paragraph");
  assert.ok(responsive.some((rule) => rule.selector.includes("last-child") && hasDeclaration(rule, "grid-row-start", "2")));
  assert.ok(responsive.some((rule) => rule.selector.includes("row-start-2") && !rule.selector.includes("last-child") && hasDeclaration(rule, "grid-row-start", "2")), "list action controls move to their second row");
});

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

test("question cancellation cannot clear or retarget a form while a deferred save is pending", async () => {
  const { cancelQuestionEdit } = await import("../src/lib/curriculumEditorState.js");
  let busy = true;
  let selected = { id: 42 };
  let form = { question: "Soal yang sedang disimpan" };
  let cancelled = 0;
  const cancel = () => { cancelled++; selected = null; form = { question: "" }; };
  let finishSave;
  const save = new Promise((resolve) => { finishSave = resolve; });
  assert.equal(cancelQuestionEdit(busy, cancel), false);
  assert.equal(cancelled, 0);
  assert.equal(selected.id, 42);
  assert.equal(form.question, "Soal yang sedang disimpan");
  finishSave(); await save; busy = false;
  assert.equal(cancelQuestionEdit(busy, cancel), true);
  assert.equal(cancelled, 1);
  assert.equal(selected, null);
  assert.equal(form.question, "");
  // The executable guard must protect the actual header control outside the fieldset.
  const editor = read("src/pages/admin/AdminModuleEditor.jsx");
  const header = editor.slice(editor.indexOf('aria-labelledby="question-form-title"'), editor.indexOf('<form onSubmit={save}', editor.indexOf('aria-labelledby="question-form-title"')));
  assert.match(header, /disabled=\{questionWriteBusy\}/);
  assert.match(header, /onClick=\{cancelEdit\}/);
});

test("phone editor gives the complete primary save action its own grid row", () => {
  const css = read("src/styles/features/editor-workspace.css");
  const phones = css.slice(css.indexOf("/* Phones:"), css.indexOf("/* Touch and narrow layouts:"));
  assert.match(phones, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(phones, /\[data-editor-save\]\s*\{\s*grid-column:\s*1\s*\/\s*-1/);
  assert.match(read("src/components/admin/EditorActionBar.jsx"), /data-editor-save/);
});

test("curriculum workflow assigns one primary action for local, saved, validated and archived states", async () => {
  const { curriculumPrimaryAction } = await import("../src/lib/curriculumEditorState.js");
  assert.equal(curriculumPrimaryAction({ dirty: true, canPublish: true }), "save");
  assert.equal(curriculumPrimaryAction({ isNew: true }), "save");
  assert.equal(curriculumPrimaryAction({}), "validate");
  assert.equal(curriculumPrimaryAction({ canPublish: true }), "publish");
  assert.equal(curriculumPrimaryAction({ archived: true }), "restore");
  assert.equal(curriculumPrimaryAction({ archived: true, dirty: true }), "save");
  const actionbar = read("src/components/admin/EditorActionBar.jsx");
  assert.match(actionbar, /variant=\{primaryAction === "save" \? "primary" : "secondary"\}/);
  const panel = read("src/components/admin/CurriculumPublishingPanel.jsx");
  for (const action of ["validate", "publish"]) assert.match(panel, new RegExp(`variant=\\{primaryAction === "${action}" \\? "primary" : "secondary"\\}`));
  assert.doesNotMatch(read("src/pages/admin/AdminModuleEditor.jsx"), /pilih Simpan modul/);
});
