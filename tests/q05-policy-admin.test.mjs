import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { cleanup, setup, withSite, signIn, rows, sql, run, repo, SQLITE, cleanEnv, passModule, progressRow } from './helpers/site.mjs';
import { policyPayload, movePolicyModule, nextPolicyVersion, draftFailure, curriculumPrimaryAction } from '../src/lib/policyEditorState.js';
import { nativeApi } from '../src/api/nativeClient.js';

after(cleanup);
const route = '/api/admin/curriculum/policies/academy-v2';
const actorId = (site) => Number(rows(site, "SELECT id FROM users WHERE email = 'pengelola@example.test'")[0].id);
const create = async (admin) => {
  const result = await admin.mutate('POST', '/api/admin/curriculum/policies', { version: 'academy-v2' });
  assert.equal(result.status, 201, result.text); return result.json.data.policy;
};
const save = async (admin, policy, patch = {}) => {
  const result = await admin.mutate('PUT', route, { ...policyPayload(policy), ...patch, expectedDraftVersion: policy.draftVersion });
  assert.equal(result.status, 200, result.text); return result.json.data.policy;
};
const activate = async (admin, site, policy) => {
  assert.equal((await admin.mutate('POST', `${route}/validate`, { expectedDraftVersion: policy.draftVersion })).json.data.valid, true);
  const ready = await admin.mutate('POST', `${route}/ready`, { expectedDraftVersion: policy.draftVersion });
  assert.equal(ready.status, 200, ready.text);
  const result = run(site, join(repo, 'scripts/curriculum/activate-policy.php'), ['--policy-version=academy-v2', '--expect-environment=local', '--apply', '--operator=Test', '--evidence-ref=TASK5']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
};
const processWrite = (site, operation, body) => new Promise((resolve, reject) => {
  const child = spawn('php', [...SQLITE, join(repo, 'tests/fixtures/q05/policy-race.php'), operation, String(actorId(site)), typeof body === 'number' ? String(body) : JSON.stringify(body)], { cwd: repo, env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }) });
  let out = ''; let err = '';
  child.stdout.on('data', (value) => out += value); child.stderr.on('data', (value) => err += value);
  child.on('error', reject); child.on('close', (code) => { assert.equal(code, 0, err); assert.equal(err, ''); resolve(JSON.parse(out)); });
});

test('policy editor payload retains mode/order/thresholds; moving does not mutate the editing buffer', () => {
  const modules = [{ moduleNumber: 1, required: true, assessmentMode: 'quiz' }, { moduleNumber: 2, required: false, assessmentMode: 'acknowledgement' }];
  assert.deepEqual(movePolicyModule(modules, 1, -1), [modules[1], modules[0]]);
  assert.equal(modules[0].moduleNumber, 1);
  assert.equal(policyPayload({ modules, tiers: [], modulePassPercent: 80, finalPassPercent: 90 }).modules[1].assessmentMode, 'acknowledgement');
  assert.equal(nextPolicyVersion([{ version: 'academy-v9' }, { version: 'academy-v2' }]), 'academy-v10');
  assert.match(draftFailure({ code: 'revision_conflict' }), /Isian Anda tetap/);
  assert.equal(curriculumPrimaryAction({ dirty: true, valid: false }), 'save');
  assert.equal(curriculumPrimaryAction({ dirty: false, valid: false }), 'validate');
  assert.equal(curriculumPrimaryAction({ dirty: false, valid: true }), 'publish');
  assert.equal(curriculumPrimaryAction({ dirty: false, valid: true, ready: true }), null);
});

test('native policy and final-bank clients send versioned canonical API contracts without an activation capability', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options = {}) => {
    calls.push({ path, ...options });
    return { ok: true, json: async () => ({ data: path.endsWith('/csrf') ? { csrfToken: 'test-csrf' } : {} }) };
  };
  try {
    const { policies, finalBank } = nativeApi.admin.curriculum;
    await policies.create('academy-v2');
    await policies.save('academy-v2', { modules: [] }, 3);
    await policies.validate('academy-v2', 4);
    await policies.ready('academy-v2', 4);
    await finalBank.save([], 5);
    await finalBank.validate(6);
    await finalBank.publish(6);
    const writes = calls.filter((call) => call.body);
    assert.deepEqual(writes.slice(1).map((call) => JSON.parse(call.body).expectedDraftVersion), [3, 4, 4, 5, 6, 6]);
    assert.equal(writes[1].method, 'PUT');
    assert.equal(writes[1].path, route);
    assert.equal(writes.at(-1).path, '/api/admin/curriculum/final-bank/publish');
    assert.equal(JSON.parse(writes.at(-1).body).confirm, true);
    assert.equal('activate' in policies, false);
  } finally { globalThis.fetch = original; }
});

test('policy tokens guard save, validation and readiness; stale requests preserve canonical and projected rows', async () => {
  const { site } = await setup('policy-tokens');
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test');
    const initial = await create(admin);
    const updated = await save(admin, initial, { modulePassPercent: 76 });
    assert.equal(updated.draftVersion, 2);
    const snapshot = () => JSON.stringify(rows(site, "SELECT * FROM curriculum_policy_versions WHERE policy_version = 'academy-v2'"));
    const before = snapshot();
    for (const [method, path, body] of [['PUT', route, policyPayload(initial)], ['POST', `${route}/validate`, {}], ['POST', `${route}/ready`, {}]]) {
      const missing = await admin.mutate(method, path, body); assert.equal(missing.status, 422);
      const stale = await admin.mutate(method, path, { ...body, expectedDraftVersion: 1 });
      assert.equal(stale.status, 409, stale.text); assert.equal(stale.json.error.code, 'revision_conflict');
      assert.equal(snapshot(), before);
    }
    assert.equal((await admin.mutate('POST', `${route}/ready`, { expectedDraftVersion: 2 })).json.error.code, 'policy_not_validated');
    assert.equal((await admin.mutate('POST', `${route}/validate`, { expectedDraftVersion: 2 })).json.data.valid, true);
    // Dependency changes after advisory validation are rechecked by readiness itself.
    sql(site, "UPDATE course_modules SET lifecycle_status = 'archived' WHERE module_number = 22");
    assert.equal((await admin.mutate('POST', `${route}/ready`, { expectedDraftVersion: 2 })).json.error.code, 'policy_not_validated');
    sql(site, "UPDATE course_modules SET lifecycle_status = 'active' WHERE module_number = 22");
    const ready = await admin.mutate('POST', `${route}/ready`, { expectedDraftVersion: 2 }); assert.equal(ready.status, 200, ready.text);
    const edited = await save(admin, ready.json.data.policy, { finalPassPercent: 82 });
    assert.equal(edited.status, 'draft'); assert.equal(edited.validatedAt, null); assert.equal(edited.draftVersion, 3);
    assert.equal((await admin.mutate('POST', `${route}/activate`, { expectedDraftVersion: 3 })).status, 404);
  });
});

test('policy admin reads and every mutation enforce admin/verification/CSRF; client assignments are ignored', async () => {
  const { site } = await setup('policy-auth');
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test');
    const learner = await signIn(api.port, 'peserta-a@example.test');
    const policy = await create(admin);
    const assignments = rows(site, 'SELECT * FROM learner_curriculum_assignments ORDER BY user_id');
    for (const [method, path, body] of [['POST', '/api/admin/curriculum/policies', { version: 'academy-v3' }], ['PUT', route, { ...policyPayload(policy), expectedDraftVersion: 1 }], ['POST', `${route}/validate`, { expectedDraftVersion: 1 }], ['POST', `${route}/ready`, { expectedDraftVersion: 1 }]]) {
      assert.equal((await learner.mutate(method, path, body)).status, 403);
      assert.equal((await admin.raw(method, path, body)).status, 419);
    }
    assert.equal((await learner.get(route)).status, 403);
    assert.equal((await api.get(route)).status, 401);
    await save(admin, policy, { learnerAssignments: [{ userId: 1, policyVersion: 'academy-v2' }] });
    assert.deepEqual(rows(site, 'SELECT * FROM learner_curriculum_assignments ORDER BY user_id'), assignments);
    sql(site, "UPDATE users SET email_verified_at = NULL, verification_required_at = CURRENT_TIMESTAMP WHERE email = 'pengelola@example.test'");
    assert.equal((await admin.get(route)).status, 401);
  });
});

test('concurrent policy saves consume one token; attachment versus deletion never leaves a dangling membership', async () => {
  const { site } = await setup('policy-races');
  let policy; let module;
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test'); policy = await create(admin);
    const result = await admin.mutate('POST', '/api/admin/modules', { moduleNumber: 200, levelNumber: 1, levelName: 'Foundation', title: 'Draft race', content: 'Test', learningObjectives: [], keyTakeaways: [], checklist: [] });
    assert.equal(result.status, 201, result.text); module = rows(site, 'SELECT id FROM course_modules WHERE module_number = 200')[0];
  });
  const input = { ...policyPayload(policy), expectedDraftVersion: 1 };
  const results = await Promise.all([processWrite(site, 'save', { ...input, modulePassPercent: 74 }), processWrite(site, 'save', { ...input, modulePassPercent: 78 })]);
  assert.equal(results.filter((result) => result.policy).length, 1);
  assert.equal(results.filter((result) => result.error?.code === 'revision_conflict').length, 1);
  const winner = results.find((result) => result.policy).policy;
  const attach = { ...policyPayload(winner), expectedDraftVersion: winner.draftVersion, modules: [...winner.modules, { moduleNumber: 200, required: false, assessmentMode: 'acknowledgement' }] };
  const raced = await Promise.all([processWrite(site, 'save', attach), processWrite(site, 'delete', Number(module.id))]);
  assert.equal(raced.filter((result) => result.policy || result.deleted).length, 1);
  assert.equal(Number(rows(site, 'SELECT COUNT(*) AS n FROM curriculum_policy_modules m LEFT JOIN course_modules c ON c.module_number = m.module_number WHERE c.id IS NULL')[0].n), 0);
});

test('assigned mode and membership govern learning and certificates across content and policy revisions', async () => {
  const { site } = await setup('policy-mode');
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test');
    const old = await signIn(api.port, 'peserta-a@example.test');
    for (const number of [1, 2, 3]) await passModule(old, site, number);
    assert.equal((await old.mutate('POST', '/api/certificates/claims', { tierNumber: 1, requestKey: randomUUID() })).status, 201);
    const evidence = rows(site, 'SELECT * FROM certificate_issuances');
    const oldProgress = await progressRow(old, 1);
    const v1 = rows(site, "SELECT * FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'");
    // Publish a module whose first membership belongs only to v2.
    const created = await admin.mutate('POST', '/api/admin/modules', { moduleNumber: 200, levelNumber: 1, levelName: 'Foundation', title: 'V2 only', content: 'Read this', learningObjectives: [], keyTakeaways: [], checklist: [] });
    assert.equal(created.status, 201, created.text);
    const moduleId = rows(site, 'SELECT id FROM course_modules WHERE module_number = 200')[0].id;
    assert.equal((await admin.mutate('POST', `/api/admin/modules/${moduleId}/publish`, { expectedDraftVersion: 1, confirm: true })).status, 200);
    assert.equal((await old.get('/api/modules')).json.data.some((module) => module.moduleNumber === 200), false);
    assert.equal((await old.get('/api/quiz?moduleNumber=200')).status, 404);
    assert.equal((await old.mutate('POST', '/api/assessments/attempts', { moduleNumber: 200, assessmentType: 'module_quiz', requestKey: randomUUID() })).status, 404);
    let policy = await create(admin);
    policy = await save(admin, policy, { modules: [{ moduleNumber: 200, required: false, assessmentMode: 'acknowledgement' }, ...policy.modules.map((member) => member.moduleNumber <= 3 ? { ...member, assessmentMode: 'acknowledgement' } : member)] });
    await activate(admin, site, policy);
    assert.deepEqual(rows(site, "SELECT requirements_json FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'"), v1.map(({ requirements_json }) => ({ requirements_json })));
    const registered = await api.mutate('POST', '/api/auth/register', { email: 'new-mode@example.test', password: 'Valid-pass1', fullName: 'New mode' });
    assert.equal(registered.status, 202);
    sql(site, "UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, verification_required_at = NULL WHERE email = 'new-mode@example.test'");
    const newcomer = await signIn(api.port, 'new-mode@example.test');
    const catalogue = (await newcomer.get('/api/modules')).json.data;
    assert.equal(catalogue[0].moduleNumber, 200);
    assert.equal(catalogue[0].order, 1);
    assert.equal((await newcomer.get('/api/quiz?moduleNumber=1')).json.data.length, 0);
    assert.equal((await newcomer.mutate('POST', '/api/assessments/attempts', { moduleNumber: 1, assessmentType: 'module_quiz', requestKey: randomUUID() })).json.error.code, 'assessment_unavailable');
    for (const number of [1, 2, 3, 200]) assert.equal((await newcomer.mutate('POST', `/api/modules/${number}/acknowledge`, {})).json.data.progress.completed, true);
    const certificate = await newcomer.mutate('POST', '/api/certificates/claims', { tierNumber: 1, requestKey: randomUUID() }); assert.equal(certificate.status, 201, certificate.text);
    assert.equal((await progressRow(newcomer, 1)).hasQuiz, false);
    const acknowledged = await progressRow(newcomer, 200);
    const bankAdded = await admin.mutate('POST', `/api/admin/modules/${moduleId}/questions`, { question: 'Retained quiz', options: ['A', 'B'], correctIndex: 0, expectedDraftVersion: 2 });
    assert.equal(bankAdded.status, 201, bankAdded.text);
    assert.equal((await admin.mutate('POST', `/api/admin/modules/${moduleId}/publish`, { expectedDraftVersion: bankAdded.json.data.draftVersion, confirm: true })).status, 200);
    assert.deepEqual(await progressRow(newcomer, 200), acknowledged, 'adding live questions cannot change acknowledgement completion');
    assert.deepEqual((await newcomer.get('/api/quiz?moduleNumber=200')).json.data, []);
    assert.deepEqual(await progressRow(old, 1), oldProgress);
    assert.deepEqual(rows(site, 'SELECT * FROM certificate_issuances WHERE id = ?', [evidence[0].id]), evidence);
    // V1 still needs this quiz even though the active policy now acknowledges it.
    const id = rows(site, 'SELECT id FROM course_modules WHERE module_number = 1')[0].id;
    const qs = (await admin.get(`/api/admin/modules/${id}/questions?view=draft`)).json.data;
    const removed = await admin.mutate('DELETE', `/api/admin/modules/${id}/questions/${qs.questions[0].id}`, { expectedDraftVersion: qs.draftVersion });
    assert.equal(removed.status, 200, removed.text);
    const refused = await admin.mutate('POST', `/api/admin/modules/${id}/publish`, { expectedDraftVersion: removed.json.data.draftVersion, confirm: true });
    assert.equal(refused.status, 422);
    assert.equal((await old.get('/api/quiz?moduleNumber=1')).json.data.length, 1);
  });
});

test('optional quiz membership requires a valid bank at readiness and protects it after activation', async () => {
  const { site } = await setup('policy-optional-quiz');
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test');
    const result = await admin.mutate('POST', '/api/admin/modules', { moduleNumber: 200, levelNumber: 1, levelName: 'Foundation', title: 'Optional quiz', content: 'Learn', learningObjectives: [], keyTakeaways: [], checklist: [] });
    assert.equal(result.status, 201, result.text);
    const id = rows(site, 'SELECT id FROM course_modules WHERE module_number = 200')[0].id;
    assert.equal((await admin.mutate('POST', `/api/admin/modules/${id}/publish`, { expectedDraftVersion: 1, confirm: true })).status, 200);
    let policy = await create(admin);
    policy = await save(admin, policy, { modules: [...policy.modules, { moduleNumber: 200, required: false, assessmentMode: 'quiz' }] });
    const invalid = await admin.mutate('POST', `${route}/validate`, { expectedDraftVersion: policy.draftVersion });
    assert.equal(invalid.json.data.valid, false);
    assert.ok(invalid.json.data.errors.some((error) => error.code === 'required_quiz_missing'));
    const added = await admin.mutate('POST', `/api/admin/modules/${id}/questions`, { question: 'Optional question', options: ['A', 'B'], correctIndex: 0, expectedDraftVersion: 2 });
    assert.equal((await admin.mutate('POST', `/api/admin/modules/${id}/publish`, { expectedDraftVersion: added.json.data.draftVersion, confirm: true })).status, 200);
    await activate(admin, site, policy);
    const bank = (await admin.get(`/api/admin/modules/${id}/questions?view=draft`)).json.data;
    const emptied = await admin.mutate('DELETE', `/api/admin/modules/${id}/questions/${bank.questions[0].id}`, { expectedDraftVersion: bank.draftVersion });
    assert.equal(emptied.status, 200, emptied.text);
    const rejected = await admin.mutate('POST', `/api/admin/modules/${id}/publish`, { expectedDraftVersion: emptied.json.data.draftVersion, confirm: true });
    assert.equal(rejected.status, 422);
    assert.ok(rejected.json.error.details.errors.some((error) => error.code === 'assessment_bank_empty'));
  });
});

test('mode backfill captures legitimate legacy optional content once and excludes Q05 drafts and new publications', async () => {
  const { site } = await setup('policy-mode-backfill');
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, 'pengelola@example.test');
    for (const moduleNumber of [200, 201]) {
      const created = await admin.mutate('POST', '/api/admin/modules', { moduleNumber, levelNumber: 1, levelName: 'Foundation', title: 'New Q05 module', content: 'Learn', learningObjectives: [], keyTakeaways: [], checklist: [] });
      assert.equal(created.status, 201, created.text);
    }
    const id = rows(site, 'SELECT id FROM course_modules WHERE module_number = 201')[0].id;
    assert.equal((await admin.mutate('POST', `/api/admin/modules/${id}/publish`, { expectedDraftVersion: 1, confirm: true })).status, 200);
    const fixture = run(site, join(repo, 'tests/fixtures/q05/legacy-policy-modes.php'), []);
    assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
    const learner = await signIn(api.port, 'peserta-a@example.test');
    const policy = (await admin.get('/api/admin/curriculum/policies/academy-v1')).json.data.policy;
    assert.deepEqual(policy.modules.filter((module) => module.moduleNumber >= 98).map(({ moduleNumber, required, assessmentMode }) => ({ moduleNumber, required, assessmentMode })), [
      { moduleNumber: 98, required: false, assessmentMode: 'acknowledgement' },
      { moduleNumber: 99, required: false, assessmentMode: 'quiz' },
    ]);
    assert.equal(policy.modules.filter((module) => module.required).length, 22);
    const acknowledged = await learner.mutate('POST', '/api/modules/98/acknowledge', {});
    assert.equal(acknowledged.json.data.progress.completed, true);
    const captured = rows(site, "SELECT requirements_json FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'");
    const beforeMembers = rows(site, "SELECT * FROM curriculum_policy_modules WHERE policy_version = 'academy-v1' ORDER BY module_number");
    for (let replay = 0; replay < 2; replay++) {
      const migration = run(site, join(repo, 'database/migrate.php'), ['--apply', '--verify', '--expect-environment=local']);
      assert.equal(migration.status, 0, migration.stdout + migration.stderr);
    }
    assert.deepEqual(rows(site, "SELECT requirements_json FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'"), captured);
    assert.deepEqual(rows(site, "SELECT * FROM curriculum_policy_modules WHERE policy_version = 'academy-v1' ORDER BY module_number"), beforeMembers);
    assert.equal((await learner.get('/api/modules')).json.data.some((module) => module.moduleNumber >= 200), false);
  });
});
