import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

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

