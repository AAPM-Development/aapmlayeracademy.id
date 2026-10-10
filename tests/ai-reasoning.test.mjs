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
