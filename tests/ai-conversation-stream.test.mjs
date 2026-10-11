import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { makeSite, seedCurriculum, seedAccount, startSite, signIn, rows, cleanup } from './helpers/site.mjs';

test.after(cleanup);

/**
 * A local OpenAI-compatible provider. Each request takes the next scripted reply
 * and records the body APPI sent, so the test can read the message list.
 */
async function mockProvider(script) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push(JSON.parse(body));
      const reply = script.shift() || [];
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const chunk of reply) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
      response.end('data: [DONE]\n\n');
    });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { requests, port: server.address().port, close: () => server.close() };
}

const text = (content) => ({ choices: [{ delta: { content } }] });

function events(sse) {
  return sse.split(/\n\n/).filter((block) => block.startsWith('event:')).map((block) => {
    const [head, data] = block.split('\n');
    return { event: head.slice(6).trim(), data: JSON.parse(data.slice(5)) };
  });
}

test('APPI sends the conversation turns, keeps a broken partial answer once and records thinking time', async () => {
  const provider = await mockProvider([
    [{ choices: [{ delta: { reasoning_details: [{ type: 'reasoning.summary', summary: 'Membaca umur flock.' }] } }] }, text('HDP ideal '), text('sekitar 93%.')],
    [text('FCR minggu 30 '), text('sekitar 2,0.')],
    [text('Sebagian jawaban'), { error: { message: 'upstream reset' } }],
  ]);
  const site = makeSite('appi-conversation-stream', {
    ai_provider: 'openai-compatible',
    ai_api_key: 'fixture-mock-provider-key',
    ai_base_url: `http://127.0.0.1:${provider.port}/v1`,
    ai_allow_local: true,
    ai_model: 'mock-model',
  });
  seedCurriculum(site);
  seedAccount(site, { email: 'learner@example.test', verified: true });
  const server = await startSite(site);
  try {
    const learner = await signIn(server.port, 'learner@example.test');
    const created = await learner.mutate('POST', '/api/ai/conversations', { title: 'Uji' });
    assert.equal(created.status, 201, created.text);
    const id = created.json.data.id;
    const ask = (message) => learner.mutate('POST', `/api/ai/conversations/${id}/stream`, { message, includeFarmContext: false });

    const first = events((await ask('Berapa HDP ideal umur 30 minggu?')).text);
    assert.deepEqual(first.filter((e) => e.event === 'delta').map((e) => e.data.text).join(''), 'HDP ideal sekitar 93%.');
    assert.equal(first.find((e) => e.event === 'reasoning').data.summary, 'Membaca umur flock.');
    assert.equal(first.at(-1).event, 'done');
    assert.equal(first.at(-1).data.persisted, true);

    const second = events((await ask('Lalu FCR-nya?')).text);
    assert.equal(second.at(-1).data.persisted, true);
    // The follow-up carries the first turn as real messages before the new question.
    const sent = provider.requests[1].messages;
    assert.deepEqual(sent.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
    assert.equal(sent[1].content, 'Berapa HDP ideal umur 30 minggu?');
    assert.equal(sent[2].content, 'HDP ideal sekitar 93%.');
    assert.match(sent[3].content, /Lalu FCR-nya\?/);

    const third = events((await ask('Bagaimana dengan mortalitas?')).text);
    const deltas = third.filter((e) => e.event === 'delta').map((e) => e.data.text);
    // No retry and no local fallback after text was already shown.
    assert.deepEqual(deltas, ['Sebagian jawaban']);
    assert.equal(third.some((e) => e.event === 'reset'), false);
    assert.equal(provider.requests.length, 3);
    assert.equal(third.at(-1).data.fallback, false);

    const detail = await learner.get(`/api/ai/conversations/${id}`);
    const assistants = detail.json.data.messages.filter((m) => m.role === 'assistant');
    assert.equal(assistants.length, 3);
    assert.equal(assistants[0].reasoningSummary, 'Membaca umur flock.');
    assert.equal(typeof assistants[0].thinkingMs, 'number');
    assert.equal(assistants[2].content, 'Sebagian jawaban');
    assert.equal(assistants[2].interrupted, true);
    assert.equal(rows(site, 'SELECT COUNT(*) AS n FROM ai_chat_messages')[0].n, 6);
  } finally {
    server.stop();
    provider.close();
  }
});

test('closing the stream stops the provider and keeps the words written so far', async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const requests = [];
  let providerClosed = false;
  const providerServer = createServer((request, response) => {
    request.resume();
    request.on('end', async () => {
      requests.push(true);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.on('close', () => { providerClosed = true; });
      for (let index = 0; index < 60 && !response.destroyed; index++) {
        response.write(`data: ${JSON.stringify(text(`kata${index} `))}\n\n`);
        await wait(100);
      }
      if (!response.destroyed) response.end('data: [DONE]\n\n');
    });
  });
  await new Promise((done) => providerServer.listen(0, '127.0.0.1', done));
  const site = makeSite('appi-conversation-stop', {
    ai_provider: 'openai-compatible',
    ai_api_key: 'fixture-mock-provider-key',
    ai_base_url: `http://127.0.0.1:${providerServer.address().port}/v1`,
    ai_allow_local: true,
    ai_model: 'mock-model',
  });
  seedCurriculum(site);
  seedAccount(site, { email: 'learner@example.test', verified: true });
  const server = await startSite(site);
  try {
    const learner = await signIn(server.port, 'learner@example.test');
    const id = (await learner.mutate('POST', '/api/ai/conversations', { title: 'Stop' })).json.data.id;
    const csrf = (await learner.get('/api/auth/csrf')).json.data.csrfToken;
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${server.port}/api/ai/conversations/${id}/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: learner.cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ message: 'Tulis panjang', includeFarmContext: false }),
      signal: controller.signal,
    });
    const reader = response.body.getReader();
    let seen = '';
    while (!seen.includes('kata3 ')) seen += new TextDecoder().decode((await reader.read()).value);
    controller.abort();
    let saved = null;
    for (let attempt = 0; attempt < 40 && !saved; attempt++) {
      await wait(250);
      saved = rows(site, "SELECT content, response_details FROM ai_chat_messages WHERE role = 'assistant'")[0] || null;
    }
    assert.ok(saved, 'the partial answer is saved');
    assert.equal(JSON.parse(saved.response_details).stopped, true);
    assert.match(saved.content, /^kata0 kata1 kata2 kata3 /);
    assert.equal(saved.content.includes('kata59'), false);
    assert.equal(providerClosed, true);
    assert.equal(requests.length, 1);
  } finally {
    server.stop();
    providerServer.close();
  }
});
