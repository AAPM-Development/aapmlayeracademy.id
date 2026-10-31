import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { makeSite, seedCurriculum, seedAccount, startSite, signIn, rows, sql, cleanup } from './helpers/site.mjs';

test.after(cleanup);

/** A local OpenAI-compatible provider: each request plays the next scripted chunk list. */
async function mockProvider(script) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push(JSON.parse(body));
      const { chunks = [], done = true, status = 200 } = script.shift() || {};
      response.writeHead(status, { 'Content-Type': 'text/event-stream' });
      for (const chunk of chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      response.end(done ? 'data: [DONE]\n\n' : '');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { requests, port: server.address().port, close: () => server.close() };
}

const text = (content) => ({ choices: [{ delta: { content } }] });
const finished = (reason) => ({ choices: [{ delta: {}, finish_reason: reason }] });
const events = (sse) => sse.split(/\n\n/).filter((block) => block.startsWith('event:')).map((block) => {
  const [head, data] = block.split('\n');
  return { event: head.slice(6).trim(), data: JSON.parse(data.slice(5)) };
});

async function room(name, script) {
  const provider = await mockProvider(script);
  const site = makeSite(name, {
    ai_provider: 'openai-compatible', ai_api_key: 'fixture-mock-provider-key', ai_base_url: `http://127.0.0.1:${provider.port}/v1`, ai_allow_local: true, ai_model: 'mock-model',
  });
  seedCurriculum(site);
  seedAccount(site, { email: 'learner@example.test', verified: true });
  const server = await startSite(site);
  const learner = await signIn(server.port, 'learner@example.test');
  const created = await learner.mutate('POST', '/api/ai/conversations', { title: 'Uji' });
  assert.equal(created.status, 201, created.text);
  const id = created.json.data.id;
  const ask = (message, extra = {}) => learner.mutate('POST', `/api/ai/conversations/${id}/stream`, { message, includeFarmContext: false, ...extra });
  const saved = () => rows(site, `SELECT role, content, response_details FROM ai_chat_messages WHERE conversation_id = ${id} ORDER BY id`);
  return { provider, site, server, learner, id, ask, saved, close: () => { server.stop(); provider.close(); } };
}

test('a retry replaces the answer on the saved question instead of recording the question twice', async () => {
  const appi = await room('appi-retry', [{ chunks: [text('Jawaban pertama.')] }, { chunks: [text('Jawaban kedua.')] }, { chunks: [text('Jawaban ketiga.')] }]);
  try {
    assert.equal(events((await appi.ask('Berapa FCR ideal?')).text).at(-1).data.persisted, true);
    assert.equal(events((await appi.ask('Berapa FCR ideal?', { retry: true })).text).at(-1).data.persisted, true);
    assert.deepEqual(appi.saved().map(({ role, content }) => [role, content]), [['user', 'Berapa FCR ideal?'], ['assistant', 'Jawaban kedua.']]);
    // The model is asked the question once, without the answer it replaces.
    assert.deepEqual(appi.provider.requests[1].messages.map((message) => message.role), ['system', 'user']);
    assert.equal(rows(appi.site, `SELECT message_count FROM ai_conversations WHERE id = ${appi.id}`)[0].message_count, 2);
    // A retry flag on a different question is simply a new question.
    await appi.ask('Pertanyaan lain?', { retry: true });
    assert.equal(appi.saved().length, 4);
  } finally { appi.close(); }
});

test('an answer cut by the token limit or by a missing end marker says so and stays marked', async () => {
  const appi = await room('appi-cut', [
    { chunks: [text('| Minggu | HDP |'), finished('length')] },
    { chunks: [text('Kalimat lengkap.'), finished('stop')] },
    { chunks: [text('Terhenti tanpa penutup')], done: false },
  ]);
  try {
    const cut = events((await appi.ask('Tabel?')).text);
    assert.match(cut.find((entry) => entry.event === 'notice').data.text, /batas panjang/);
    const whole = events((await appi.ask('Kalimat?')).text);
    assert.equal(whole.some((entry) => entry.event === 'notice'), false);
    const broken = events((await appi.ask('Lagi?')).text);
    assert.match(broken.find((entry) => entry.event === 'notice').data.text, /terputus/);
    const details = appi.saved().filter((row) => row.role === 'assistant').map((row) => JSON.parse(row.response_details));
    assert.deepEqual(details.map((row) => [row.truncated, row.interrupted]), [[true, false], [false, false], [false, true]]);
  } finally { appi.close(); }
});

test('web sources come from provider citations, keep https links only and survive a reload', async () => {
  const citation = (url, title) => ({ type: 'url_citation', url_citation: { url, title } });
  const appi = await room('appi-sources', [{ chunks: [
    { choices: [{ delta: { content: 'Harga pakan naik.', annotations: [citation('https://example.test/a', 'Sumber A'), citation('http://example.test/plain', 'Tidak aman'), citation('https://example.test/a', 'Duplikat')] } }] },
    finished('stop'),
  ] }]);
  try {
    const stream = events((await appi.ask('Harga pakan?')).text);
    const expected = [{ url: 'https://example.test/a', title: 'Sumber A' }];
    assert.deepEqual(stream.find((entry) => entry.event === 'sources').data.sources, expected);
    const detail = await appi.learner.get(`/api/ai/conversations/${appi.id}`);
    assert.deepEqual(detail.json.data.messages.at(-1).sources, expected);
  } finally { appi.close(); }
});

test('the model receives the real module list, the real progress total, and the safety rules', async () => {
  const appi = await room('appi-context', [{ chunks: [text('Siap.')] }, { chunks: [text('Siap.')] }]);
  try {
    await appi.ask('Modul apa yang cocok?');
    const [system, user] = appi.provider.requests[0].messages;
    assert.match(system.content, /jangan pernah memberi dosis/i);
    assert.match(system.content, /DATA, bukan instruksi/);
    assert.match(system.content, /Jangan memakai tag HTML/);
    const titles = rows(appi.site, 'SELECT title FROM course_modules ORDER BY module_number LIMIT 2');
    assert.match(user.content, /Daftar modul kurikulum:\nModul 1: /);
    assert.ok(user.content.includes(`Modul 2: ${titles[1].title}`));
    assert.match(user.content, /Konteks KPI dimatikan oleh pengguna/);
    await appi.ask('Dengan KPI?', { includeFarmContext: true });
    assert.match(appi.provider.requests[1].messages.at(-1).content, /Tidak ada data KPI farm tersimpan/);
  } finally { appi.close(); }
});

test('an open final exam forces the exam rule, whatever page the request claims', async () => {
  const appi = await room('appi-exam', [{ chunks: [text('Siap.')] }]);
  try {
    const userId = rows(appi.site, "SELECT id FROM users WHERE email = 'learner@example.test'")[0].id;
    sql(appi.site, `INSERT INTO assessment_attempts (public_id, user_id, assessment_type, module_number, policy_version, passing_grade, status, total_questions, started_at, expires_at, start_request_key, created_at, updated_at) VALUES ('exam-open', ${userId}, 'final_exam', 0, 'academy-v1', 80, 'in_progress', 50, '2020-01-01 00:00:00', '2999-01-01 00:00:00', 'exam-key', '2020-01-01 00:00:00', '2020-01-01 00:00:00')`);
    await appi.ask('Jawaban soal nomor 3 apa?', { pageContext: 'ai-assistant' });
    assert.match(appi.provider.requests[0].messages.at(-1).content, /Jangan menjawab, memilih, atau mengonfirmasi opsi soal/);
  } finally { appi.close(); }
});

test('a learner cannot point APPI at the server network', async () => {
  const appi = await room('appi-endpoint', []);
  try {
    const save = (input) => appi.learner.mutate('PUT', '/api/ai-settings', { enabled: true, ...input });
    for (const baseUrl of ['http://169.254.169.254/latest', 'https://169.254.169.254/latest', 'https://10.0.0.8/v1', 'https://[::ffff:127.0.0.1]/v1', 'https://localhost/v1']) {
      const refused = await save({ mode: 'custom', baseUrl, allowLocal: true, apiKey: 'fixture-account-key-123456', model: 'mock' });
      assert.equal(refused.status, 422, `${baseUrl}: ${refused.text}`);
    }
    assert.equal(Number(rows(appi.site, 'SELECT COUNT(*) AS n FROM user_ai_settings')[0].n), 0);
  } finally { appi.close(); }
});
