import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { makeSite, seedCurriculum, seedAccount, startSite, signIn, rows, sql, cleanup } from './helpers/site.mjs';
import { settledMarkdown } from '../src/lib/streamingMarkdown.js';

test.after(cleanup);

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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

test('a learner on a stored provider keeps the model the admin chose; an admin can pick another', async () => {
  const provider = await mockProvider([{ chunks: [text('Siap.')] }, { chunks: [text('Siap.')] }]);
  const site = makeSite('appi-provider-mode');
  seedCurriculum(site);
  const learnerId = seedAccount(site, { email: 'learner@example.test', verified: true });
  const ownerId = seedAccount(site, { email: 'owner@example.test', role: 'super_admin', verified: true });
  const server = await startSite(site);
  try {
    const owner = await signIn(server.port, 'owner@example.test');
    const stored = await owner.mutate('PUT', '/api/admin/ai-settings', { config: { type: 'openai-compatible', label: 'Gateway AAPM', baseUrl: `http://127.0.0.1:${provider.port}/v1`, allowLocal: true, authMode: 'none', model: 'model-admin', activate: true } });
    assert.equal(stored.status, 200, stored.text);
    const providerId = stored.json.data.providers.find((item) => item.label === 'Gateway AAPM').id;
    const savedModel = (userId) => rows(site, 'SELECT mode, provider_id, model FROM user_ai_settings WHERE user_id = ?', [userId])[0];
    const modelSent = async (account) => {
      const { id } = (await account.mutate('POST', '/api/ai/conversations', { title: 'Model' })).json.data;
      await account.mutate('POST', `/api/ai/conversations/${id}/stream`, { message: 'Tes model', includeFarmContext: false });
      return provider.requests.at(-1).model;
    };

    const learner = await signIn(server.port, 'learner@example.test');
    const asked = await learner.mutate('PUT', '/api/ai-settings', { mode: 'provider', providerId, model: 'model-mahal-pilihan-peserta' });
    assert.equal(asked.status, 200, asked.text);
    assert.equal(asked.json.data.model, '');
    assert.deepEqual(savedModel(learnerId), { mode: 'provider', provider_id: providerId, model: '' });
    assert.equal(await modelSent(learner), 'model-admin');

    const chosen = await owner.mutate('PUT', '/api/ai-settings', { mode: 'provider', providerId, model: 'model-pilihan-admin' });
    assert.equal(chosen.status, 200, chosen.text);
    assert.deepEqual(savedModel(ownerId), { mode: 'provider', provider_id: providerId, model: 'model-pilihan-admin' });
    assert.equal(await modelSent(owner), 'model-pilihan-admin');
  } finally { server.stop(); provider.close(); }
});

const drawn = (markdown) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown));

test('a table being written never shows raw pipes, and grows one whole row at a time', () => {
  const answer = 'Ringkasan minggu ini:\n\n| Minggu | HDP |\n| --- | --- |\n| 30 | 93 |\n| 31 | 92 |\n\nPeriksa pakan.';
  for (let end = 1; end <= answer.length; end++) {
    const html = drawn(settledMarkdown(answer.slice(0, end)));
    assert.equal(html.includes('|'), false, `after ${end} characters: ${html}`);
    if (html.includes('<table>')) assert.equal(html.match(/<tr>/g).length, 1 + (html.match(/<td>/g)?.length ?? 0) / 2, `half a row after ${end} characters`);
  }
  assert.equal(settledMarkdown(answer), answer);
});

test('holding a table back leaves everything else as written', () => {
  for (const text of ['Tanpa tabel sama sekali', 'Pakan | air di tengah kalimat', '| bukan tabel\n| baris kedua', '```\n| kode | bukan tabel |', '| a |\nteks biasa\n']) {
    assert.equal(settledMarkdown(text), text);
  }
  assert.equal(settledMarkdown('Awal.\n\n| Minggu |'), 'Awal.\n');
});

test('Stop works from the moment a question is sent, and a stopped answer does not hold the composer', () => {
  const chat = read('src/components/ai/AiChatProvider.jsx');
  assert.ok(chat.indexOf('new AbortController()') < chat.indexOf('ensureConversation(message'), 'the controller exists before the chat is created');
  assert.match(chat, /Promise\.race\(\[preparing, stoppedFirst\]\)/);
  // A new question in the same chat waits for the save, or that save lands after it.
  assert.match(chat, /if \(stopSave\?\.conversationId === activeRef\.current\) await stopSave\.done;/);
  const stopBranch = chat.slice(chat.indexOf('if (stopRequestedRef.current) {'), chat.indexOf('// A failed fetch explains itself'));
  assert.match(stopBranch, /settleStoppedAnswer\(/);
  assert.doesNotMatch(stopBranch, /await /, 'send returns at once, so the composer is free');
  // The polling shows on the answer's own save link, so it cannot save the answer twice.
  assert.match(chat, /setRetryingMessageId\(assistantId\);/);
  // A chat made by a request that was stopped does not stay behind, empty.
  assert.match(chat, /if \(signal\.aborted\) \{\n[^}]*conversations\.delete\(conversation\.id\)/);
});

test('a screen reader hears that the answer was stopped, not that it finished', () => {
  assert.match(read('src/components/ai/StreamAnnouncer.jsx'), /if \(stopped\) setText\("Jawaban APPI dihentikan\."\);/);
  assert.match(read('src/components/ai/AiChatProvider.jsx'), /settleStreamPhase\("stopped"\)/);
  for (const surface of ['src/pages/AiAssistant.jsx', 'src/components/ai/FloatingAiAssistant.jsx']) {
    assert.match(read(surface), /<StreamAnnouncer [^>]*stopped=\{streamPhase === "stopped"\}/, surface);
  }
});

test('the workspace and the quick panel share one way to ask, so they cannot drift apart', () => {
  const page = read('src/pages/AiAssistant.jsx');
  const panel = read('src/components/ai/FloatingAiAssistant.jsx');
  for (const [name, source] of [['workspace', page], ['panel', panel]]) {
    assert.match(source, /useChatSubmit\(\{/, name);
    assert.match(source, /<AiJumpToLatest onClick=\{jumpToLatest\} \/>/, name);
    assert.match(source, /Memuat riwayat…/, name);
    assert.doesNotMatch(source, /new FileReader|analisis foto farm/, name);
  }
  assert.doesNotMatch(page, /function personalizedSuggestions/);
  assert.match(read('src/lib/aiSuggestions.js'), /`Modul \$\{moduleNo\(nextModule\)\}: /);
  assert.match(panel, /<Ic name="refresh" \/>Buat ulang/);
  assert.doesNotMatch(panel, /bottom-\[5\.7rem\]|aapm-token-control/);
  // Quick actions cannot be pressed while a chat loads: the list they would act on is not shown yet.
  assert.match(panel, /\{isLoadingConversation \? \(\n\s*<p [^>]*role="status">Memuat riwayat…<\/p>\n\s*\) : messages\.length === 0 \? \(/);
});

test('the APPI stylesheets carry no rules for classes the app no longer renders', () => {
  const css = `${read('src/styles/features/ai-chat.css')}\n${read('src/styles/features/appi-room.css')}`;
  assert.doesNotMatch(css, /\.aapm-(ai-composer-(frame|toggle|tools|switch|context)|ai-composer--compact|chat-suggestion|chat-welcome|room__|ai-user-bubble|ai-answer-|chat-header__|token-(popover|scrim))/);
});
