import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { makeSite, seedCurriculum, seedAccount, startSite, signIn, Api, rows, cleanup } from './helpers/site.mjs';

test.after(cleanup);

test('admin imports server OpenAI into encrypted storage without leaking or redirecting the key', async () => {
  const secret = 'fixture-openai-server-credential';
  const site = makeSite('openai-admin-import', { openai_api_key: secret, ai_provider: 'openai-compatible', ai_api_key: secret, ai_base_url: 'https://api.openai.com/v1', ai_model: 'gpt-4o-mini', ai_settings_encryption_key: 'fixture-encryption-key-for-admin-tests' });
  seedCurriculum(site);
  seedAccount(site, { email: 'owner@example.test', role: 'super_admin', verified: true });
  seedAccount(site, { email: 'learner@example.test', verified: true });
  const server = await startSite(site);
  try {
    const owner = await signIn(server.port, 'owner@example.test');
    const before = await owner.get('/api/admin/ai-settings');
    assert.equal(before.json.data.managedByPrivateConfig, true);
    assert.equal(before.json.data.serverOpenAiKeyAvailable, true);
    const unauthorized = await new Api(server.port).mutate('PUT', '/api/admin/ai-settings', { action: 'importServerOpenAi' });
    assert.equal(unauthorized.status, 401);
    const learner = await signIn(server.port, 'learner@example.test');
    assert.equal((await learner.mutate('PUT', '/api/admin/ai-settings', { action: 'importServerOpenAi' })).status, 403);
    assert.equal((await owner.raw('PUT', '/api/admin/ai-settings', { action: 'importServerOpenAi' })).status, 419);
    const imported = await owner.mutate('PUT', '/api/admin/ai-settings', { action: 'importServerOpenAi', config: { baseUrl: 'https://example.test/stolen' } });
    assert.equal(imported.status, 200);
    assert.equal(imported.text.includes(secret), false);
    assert.equal(imported.json.data.managedByPrivateConfig, false);
    const provider = imported.json.data.providers.find((item) => item.id === 'openai-server');
    assert.equal(provider.keyStorage, 'encrypted_database');
    assert.equal(provider.apiKeyConfigured, true);
    assert.equal(provider.baseUrl, 'https://api.openai.com/v1');
    const stored = rows(site, "SELECT setting_value FROM app_settings WHERE setting_key = 'ai_provider_registry'")[0];
    assert.equal(JSON.stringify(stored).includes(secret), false);
    const changed = await owner.mutate('PUT', '/api/admin/ai-settings', { config: { ...provider, model: 'gpt-4.1-mini' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.json.data.model, 'gpt-4.1-mini');
    assert.equal(changed.json.data.apiKeyConfigured, true);
    const redirect = await owner.mutate('PUT', '/api/admin/ai-settings', { config: { ...provider, baseUrl: 'https://example.test/v1' } });
    assert.equal(redirect.status, 422);
    assert.equal(redirect.json.error.code, 'ai_server_key_endpoint');
    const other = await owner.mutate('PUT', '/api/admin/ai-settings', { config: { type: 'openai-compatible', label: 'Other gateway', baseUrl: 'https://example.test/v1', model: 'model-a', activate: false } });
    assert.equal(other.status, 200);
    assert.equal(other.json.data.providers.find((item) => item.label === 'Other gateway').apiKeyConfigured, false);
    assert.equal(rows(site, 'SELECT COUNT(*) AS n FROM course_modules')[0].n, 22);
  } finally { server.stop(); }
});

test('server key import fails without encryption and rolls back private provider management', async () => {
  const site = makeSite('openai-import-no-encryption', { openai_api_key: 'fixture-openai-no-encryption', ai_provider: 'openai-compatible', ai_api_key: 'fixture-openai-no-encryption', ai_base_url: 'https://api.openai.com/v1' });
  seedCurriculum(site);
  seedAccount(site, { email: 'owner@example.test', role: 'super_admin', verified: true });
  const server = await startSite(site);
  try {
    const owner = await signIn(server.port, 'owner@example.test');
    const imported = await owner.mutate('PUT', '/api/admin/ai-settings', { action: 'importServerOpenAi' });
    assert.equal(imported.status, 503);
    const status = await owner.get('/api/admin/ai-settings');
    assert.equal(status.json.data.managedByPrivateConfig, true);
    assert.equal(rows(site, "SELECT COUNT(*) AS n FROM app_settings WHERE setting_key = 'ai_manage_in_admin'")[0].n, 0);
  } finally { server.stop(); }
});

function summaries(delta) {
  const result = spawnSync('php', ['-r', 'require "public/api/openrouter.php"; echo json_encode(ai_public_reasoning_summaries(json_decode(stream_get_contents(STDIN), true)));'], { input: JSON.stringify(delta), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('only provider-designated summaries reach the public reasoning renderer', () => {
  assert.deepEqual(summaries({ reasoning: 'private', reasoning_content: 'private', reasoning_details: [
    { type: 'reasoning.text', text: 'raw' },
    { type: 'reasoning.encrypted', data: 'encrypted' },
    { type: 'reasoning.summary', summary: 'Memeriksa periode data KPI.' },
    { type: 'reasoning.summary', summary: ['invalid'] }, null,
  ] }), ['Memeriksa periode data KPI.']);
});

test('missing or malformed reasoning remains empty and oversized summaries are bounded', () => {
  assert.deepEqual(summaries({}), []);
  assert.deepEqual(summaries({ reasoning_details: 'invalid' }), []);
  assert.equal(summaries({ reasoning_details: [{ type: 'reasoning.summary', summary: 'a'.repeat(15000) }] })[0].length, 12000);
});

test('response metadata migration preserves old messages and reads summaries after reopening SQLite', () => {
  const php = String.raw`
require 'public/api/bootstrap.php';
$path = tempnam(sys_get_temp_dir(), 'appi-details-');
try {
 $pdo = new PDO('sqlite:' . $path);
 $pdo->exec('CREATE TABLE ai_chat_messages (id INTEGER PRIMARY KEY, role TEXT, content TEXT)');
 $pdo->exec("INSERT INTO ai_chat_messages VALUES (1, 'assistant', 'Jawaban lama')");
 ensure_ai_response_details($pdo, 'sqlite');
 ensure_ai_response_details($pdo, 'sqlite');
 $insert = $pdo->prepare('INSERT INTO ai_chat_messages (id, role, content, response_details) VALUES (2, ?, ?, ?)');
 $insert->execute(['assistant', 'Jawaban akhir', json_encode(['reasoningSummary'=>'Ringkasan publik', 'reasoningObserved'=>true])]);
 $pdo = null;
 $pdo = new PDO('sqlite:' . $path);
 echo json_encode(array_map('present_ai_chat_message', $pdo->query('SELECT * FROM ai_chat_messages ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)));
 $pdo = null;
} finally { unlink($path); }
`;
  const result = spawnSync('php', [...(process.platform === 'win32' ? ['-d', 'extension=php_sqlite3.dll', '-d', 'extension=php_pdo_sqlite.dll'] : []), '-r', php], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const [old, current] = JSON.parse(result.stdout);
  assert.equal(old.content, 'Jawaban lama');
  assert.equal(old.reasoningSummary, '');
  assert.equal(current.content, 'Jawaban akhir');
  assert.equal(current.reasoningSummary, 'Ringkasan publik');
  assert.equal(current.reasoningObserved, true);
});

