// Q03 regression suite: server-authoritative assessment, module completion,
// final eligibility, and progress integrity. Runs the real API under `php -S`
// against disposable SQLite, or task-owned PDOmysql when explicitly configured.
// Races use separate PHP processes.
// Nothing here touches staging or production.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeSite as makeNativeSite } from "./helpers/site.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "tests", "fixtures");
const SQLITE = ["-d", "extension=php_pdo_sqlite.dll", "-d", "extension=php_sqlite3.dll", "-d", "extension=php_pdo_mysql.dll"];
const PASSWORD = "Valid-pass1";
const created = [];

after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

function scratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `aapm-q03-${name}-`));
  created.push(dir);
  return dir;
}

function cleanEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("AAPLAYERACADEMY_") && !key.startsWith("AAPM_")) env[key] = value;
  }
  return { ...env, ...extra };
}

const forward = (path) => path.replace(/\\/g, "/");

function phpLiteral(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function phpHash(password) {
  return spawnSync("php", ["-r", "echo password_hash($argv[1], PASSWORD_DEFAULT);", password], {
    encoding: "utf8",
    env: cleanEnv(),
  }).stdout;
}

/** A disposable local site: SQLite, dev token exposure, no mail transport. */
function makeSite(name, overrides = {}) {
  if (process.env.AAPM_TEST_MYSQL_CONFIG) {
    const site = makeNativeSite(name, overrides);
    created.push(site.root);
    return site;
  }
  const root = scratch(name);
  const dbPath = join(root, "app.sqlite");
  writeFileSync(dbPath, "");
  const settings = {
    environment: "local",
    db_driver: "sqlite",
    db_path: forward(dbPath),
    app_url: "http://127.0.0.1",
    expose_dev_reset_token: true,
    mail_from: "",
    environment_marker_required: false,
    admin_emails: "",
    ...overrides,
  };
  const body = Object.entries(settings).map(([key, value]) => `    '${key}' => ${phpLiteral(value)},`).join("\n");
  const config = join(root, "config.php");
  writeFileSync(config, `<?php\nreturn [\n${body}\n];\n`);
  return { root, dbPath, config };
}

function run(site, script, args) {
  return spawnSync("php", [...SQLITE, script, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
}

function sql(site, text, params = []) {
  const result = run(site, join(fixtures, "q02", "sql.php"), [JSON.stringify({ sql: text, params })]);
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout;
}

function rows(site, text, params = []) {
  return JSON.parse(sql(site, text, params));
}

function seedCurriculum(site) {
  // The shipped seed: 22 required modules, one quiz question each, and the final-exam questions (module 0).
  const result = spawnSync("php", [...SQLITE, join(repo, "database", "seed.php")], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

function bulk(site, spec) {
  const result = run(site, join(fixtures, "q03", "bulk.php"), [JSON.stringify(spec)]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

function seedAccount(site, { email, role = "user", verified = false, password = PASSWORD, name = "Peserta Uji" }) {
  sql(
    site,
    "INSERT INTO users (email, password_hash, full_name, role, email_verified_at, verification_required_at, auth_version) VALUES (?, ?, ?, ?, ?, NULL, 1)",
    [email, phpHash(password), name, role, verified ? "2026-10-01 00:00:00" : null]
  );
  return Number(rows(site, "SELECT id FROM users WHERE email = ?", [email])[0].id);
}

/**
 * The answer key for one attempt, read from the stored item snapshots. This is
 * the server's own record; the learner view never carries it. Tests use it only
 * to choose a correct or wrong answer.
 */
function attemptKey(site, publicId) {
  const key = new Map();
  const found = rows(
    site,
    "SELECT i.id, i.question_snapshot_json FROM assessment_attempt_items i JOIN assessment_attempts a ON a.id = i.attempt_id WHERE a.public_id = ?",
    [publicId]
  );
  for (const row of found) {
    const snapshot = JSON.parse(row.question_snapshot_json);
    key.set(Number(row.id), { correct: Number(snapshot.correctIndex), count: snapshot.options.length });
  }
  return key;
}

const wrongIndex = (entry) => (entry.correct + 1) % entry.count;

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/** Cookie-carrying client. Mutations fetch a fresh CSRF token first, as the browser does. */
class Api {
  constructor(port) {
    this.port = port;
    this.cookie = "";
  }

  async raw(method, path, body, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(";")[0];
      if (pair.startsWith("aapm_layer_session=")) this.cookie = pair;
    }
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json, text };
  }

  get(path) {
    return this.raw("GET", path);
  }

  async mutate(method, path, body) {
    const csrf = await this.raw("GET", "/api/auth/csrf");
    if (!csrf.json?.data?.csrfToken) throw new Error(`csrf failed: ${csrf.status} ${csrf.text.slice(0, 400)}`);
    return this.raw(method, path, body, { "x-csrf-token": csrf.json.data.csrfToken });
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function startSite(site) {
  const port = await freePort();
  let stderr = "";
  const child = spawn("php", [...SQLITE, "-S", `127.0.0.1:${port}`, "-t", "public", join("public", "router.php")], {
    cwd: repo,
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => (stderr += chunk));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`php server exited: ${stderr}`);
    try {
      await new Api(port).get("/api/health");
      return { port, stop: () => child.kill() };
    } catch {
      await sleep(100);
    }
  }
  child.kill();
  throw new Error("php server did not start");
}

async function withSite(site, run) {
  const server = await startSite(site);
  try {
    return await run(new Api(server.port));
  } finally {
    server.stop();
  }
}

async function signIn(port, email, password = PASSWORD) {
  const api = new Api(port);
  const reply = await api.mutate("POST", "/api/auth/login", { email, password });
  assert.equal(reply.status, 200, reply.text);
  return api;
}

/** Seeded curriculum plus one learner; the admin account is used only by the admin test. */
async function setup(name) {
  const site = makeSite(name);
  seedCurriculum(site);
  const learnerA = seedAccount(site, { email: "peserta-a@example.test", verified: true });
  seedAccount(site, { email: "peserta-b@example.test", verified: true });
  seedAccount(site, { email: "pengelola@example.test", role: "super_admin", verified: true });
  return { site, learnerA };
}

/** Starts a module quiz, answers its one question correctly, and submits it. */
async function passModule(api, site, moduleNumber) {
  const started = await api.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber, requestKey: randomUUID() });
  assert.equal(started.status, 201, started.text);
  const attempt = started.json.data.attempt;
  const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
  const answer = await api.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
  assert.equal(answer.status, 200, answer.text);
  const submitted = await api.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
  assert.equal(submitted.status, 200, submitted.text);
  return submitted.json.data.attempt;
}

async function passAllRequired(api, site) {
  for (let number = 1; number <= 22; number++) {
    await passModule(api, site, number);
  }
}

/** Answers a final exam: the first `correctCount` items correctly, the rest wrongly. */
async function answerFinal(api, site, attempt, correctCount) {
  const key = attemptKey(site, attempt.id);
  for (let index = 0; index < attempt.questions.length; index++) {
    const entry = key.get(attempt.questions[index].id);
    const answerIndex = index < correctCount ? entry.correct : wrongIndex(entry);
    const saved = await api.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[index].id, answerIndex });
    assert.equal(saved.status, 200, saved.text);
  }
}

async function progressRow(api, moduleNumber) {
  const reply = await api.get("/api/progress");
  return reply.json.data.find((row) => row.moduleNumber === moduleNumber) ?? null;
}

/** Runs one submit as its own PHP process, so two submits can race on the same SQLite file. */
function submitProcess(site, publicId, userId) {
  return new Promise((done, reject) => {
    const child = spawn("php", [...SQLITE, join(fixtures, "q03", "submit-attempt.php"), publicId, String(userId), randomUUID()], {
      cwd: repo,
      env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? done(JSON.parse(out.trim())) : reject(new Error(out + err))));
  });
}

/* -------------------------------------------------------- confidentiality */

test("A01 the legacy quiz endpoint never exposes correct answers or explanations", async () => {
  const { site } = await setup("a01");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const reply = await learner.get("/api/quiz?moduleNumber=1");
    assert.equal(reply.status, 200);
    assert.ok(!reply.text.includes("correctIndex"));
    assert.ok(!reply.text.includes("explanation"));
  });
});

test("A02 starting a module attempt returns an opaque ID and no answer data", async () => {
  const { site } = await setup("a02");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const reply = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 1, requestKey: randomUUID() });
    assert.equal(reply.status, 201);
    assert.match(reply.json.data.attempt.id, /^[a-f0-9]{48}$/);
    assert.equal(reply.json.data.attempt.questions.length, 1);
    assert.ok(!reply.text.includes("correctIndex"));
    assert.ok(!reply.text.includes("feedback"));
  });
});

test("A03 repeating a start request returns the same attempt", async () => {
  const { site } = await setup("a03");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const key = randomUUID();
    const first = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 2, requestKey: key });
    const second = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 2, requestKey: key });
    assert.equal(first.json.data.attempt.id, second.json.data.attempt.id);
    assert.equal(second.status, 200, "a repeat is not a new creation");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts")[0].n), 1);
  });
});

test("A04 an unchecked module question carries no answer key, feedback, or explanation", async () => {
  const { site } = await setup("a04");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 3, requestKey: randomUUID() })).json.data.attempt;
    assert.ok(!JSON.stringify(attempt).includes("correctIndex"));
    assert.ok(!JSON.stringify(attempt).includes("feedback"));
    assert.ok(!JSON.stringify(attempt).includes("explanation"));
    const read = await learner.get(`/api/assessments/attempts/${attempt.id}`);
    assert.ok(!read.text.includes("correctIndex"));
    assert.ok(!read.text.includes("explanation"));
  });
});

test("A05 checking a module answer returns the server's own feedback", async () => {
  const { site } = await setup("a05");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 3, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    const checked = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: wrongIndex(entry) });
    assert.equal(checked.status, 200);
    assert.equal(checked.json.data.feedback.isCorrect, false);
    assert.equal(checked.json.data.feedback.correctIndex, entry.correct);
    assert.ok(checked.json.data.feedback.explanation.length > 0);
  });
});

test("A06 a checked module answer cannot be changed; repeating it returns the same feedback", async () => {
  const { site } = await setup("a06");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 4, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    const first = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    const again = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    assert.equal(again.status, 200);
    assert.deepEqual(again.json.data.feedback, first.json.data.feedback);
    const changed = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: wrongIndex(entry) });
    assert.equal(changed.status, 409);
    assert.equal(changed.json.error.code, "answer_locked");
  });
});

/* ------------------------------------------------------------- grading */

test("A07 an incomplete quiz is refused and names the missing questions", async () => {
  const { site } = await setup("a07");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 5, requestKey: randomUUID() })).json.data.attempt;
    const submitted = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submitted.status, 422);
    assert.equal(submitted.json.error.code, "incomplete_answers");
    assert.deepEqual(submitted.json.error.details.missingOrdinals, [1]);
  });
});

test("A08 a failing quiz is recorded as failed and does not complete the module", async () => {
  const { site } = await setup("a08");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 6, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: wrongIndex(entry) });
    const submitted = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submitted.json.data.attempt.result.passed, false);
    const progress = await progressRow(learner, 6);
    assert.equal(progress.completed, false);
    assert.equal(progress.completionStatus, "quiz_failed");
  });
});

test("A09 a passing quiz records verified completion; A10 a failed retake keeps it", async () => {
  const { site } = await setup("a09");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const passed = await passModule(learner, site, 7);
    assert.equal(passed.result.passed, true);
    assert.equal((await progressRow(learner, 7)).completed, true);

    const retake = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 7, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, retake.id).get(retake.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${retake.id}/answers`, { questionId: retake.questions[0].id, answerIndex: wrongIndex(entry) });
    await learner.mutate("POST", `/api/assessments/attempts/${retake.id}/submit`, { requestKey: randomUUID() });
    assert.equal((await progressRow(learner, 7)).completed, true, "a failed retake never erases a verified pass");
  });
});

test("A11 to A13 client-supplied completion, scores, and final results are refused", async () => {
  const { site } = await setup("a11");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const completed = await learner.mutate("POST", "/api/progress", { moduleNumber: 1, completed: true });
    assert.equal(completed.status, 422);
    assert.equal(completed.json.error.code, "academic_field_forbidden");
    assert.deepEqual(completed.json.error.details.fields, ["completed"]);

    const score = await learner.mutate("POST", "/api/progress", { moduleNumber: 1, quizScore: 1, quizTotal: 1 });
    assert.equal(score.status, 422);
    assert.equal(score.json.error.code, "academic_field_forbidden");

    const finalForged = await learner.mutate("POST", "/api/progress", { moduleNumber: 0, completed: true, quizScore: 6, quizTotal: 6 });
    assert.equal(finalForged.status, 422);

    const plain = await learner.mutate("POST", "/api/progress", { moduleNumber: 1 });
    assert.equal(plain.status, 410, "unsafe progress writes never succeed silently");
    assert.equal(plain.json.error.code, "progress_write_retired");
    // /api/progress lists only modules with recorded evidence; no row means not completed.
    const row = await progressRow(learner, 1);
    assert.ok(row === null || row.completed === false, "no forged completion was stored");
  });
});

test("A14 another learner's attempt is reported as not found, never as forbidden", async () => {
  const { site } = await setup("a14");
  await withSite(site, async (api) => {
    const owner = await signIn(api.port, "peserta-a@example.test");
    const other = await signIn(api.port, "peserta-b@example.test");
    const attempt = (await owner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 8, requestKey: randomUUID() })).json.data.attempt;
    assert.equal((await other.get(`/api/assessments/attempts/${attempt.id}`)).status, 404);
    const answer = await other.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: 0 });
    assert.equal(answer.status, 404);
    const submit = await other.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submit.status, 404);
  });
});

test("A15 a curriculum edit after an attempt starts does not change the grade", async () => {
  const { site } = await setup("a15");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 9, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    sql(site, "UPDATE quiz_questions SET correct_index = ? WHERE module_number = 9", [wrongIndex(entry)]);
    const answer = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    assert.equal(answer.json.data.feedback.isCorrect, true, "grading uses the snapshot taken at start");
  });
});

test("A16 a repeated submit returns the one committed result", async () => {
  const { site } = await setup("a16");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 10, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    const first = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    const second = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(second.status, 200);
    assert.deepEqual(second.json.data.attempt.result, first.json.data.attempt.result);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE public_id = ? AND status = 'submitted'", [attempt.id])[0].n), 1);
  });
});

test("A17 concurrent submits from separate processes commit exactly one result", async () => {
  const { site, learnerA } = await setup("a17");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 11, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    const outcomes = await Promise.all([submitProcess(site, attempt.id, learnerA), submitProcess(site, attempt.id, learnerA)]);
    assert.ok(outcomes.every((outcome) => outcome.status === "submitted"));
    assert.equal(outcomes[0].submittedAt, outcomes[1].submittedAt, "both observers see the same committed result");
    assert.equal(outcomes[0].correctAnswers, outcomes[1].correctAnswers);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE public_id = ? AND status = 'submitted'", [attempt.id])[0].n), 1);
  });
});

function answerProcess(site, attemptId, userId, questionId, answerIndex) {
  return new Promise((resolve, reject) => {
    const child = spawn("php", [...SQLITE, join(fixtures, "q03/answer-attempt.php"), attemptId, String(userId), String(questionId), String(answerIndex)], { cwd: repo, env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }) });
    let out = ""; let err = "";
    child.stdout.on("data", chunk => out += chunk); child.stderr.on("data", chunk => err += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(out.trim())) : reject(new Error(err)));
  });
}

test("concurrent module answers lock exactly one checked selection and answer/submit races preserve its grade", async () => {
  const { site, learnerA } = await setup("answer-races");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const started = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 11, requestKey: randomUUID() });
    assert.equal(started.status, 201, started.text);
    const attempt = started.json.data.attempt;
    const questionId = attempt.questions[0].id;
    const key = attemptKey(site, attempt.id).get(questionId);
    const replies = await Promise.all([answerProcess(site, attempt.id, learnerA, questionId, key.correct), answerProcess(site, attempt.id, learnerA, questionId, wrongIndex(key))]);
    assert.equal(replies.filter(reply => reply.error?.code === "answer_locked").length, 1);
    const accepted = replies.find(reply => reply.checked);
    assert.ok(accepted);
    const stored = rows(site, "SELECT * FROM assessment_attempt_items WHERE id = ?", [questionId])[0];
    assert.equal(Number(stored.answer_index), accepted.selectedIndex);
    assert.ok(stored.checked_at);
    const again = await answerProcess(site, attempt.id, learnerA, questionId, accepted.selectedIndex);
    assert.deepEqual(again, accepted, "same checked answer is idempotent");
    const alternate = accepted.selectedIndex === key.correct ? wrongIndex(key) : key.correct;
    const [answer, submitted] = await Promise.all([answerProcess(site, attempt.id, learnerA, questionId, alternate), submitProcess(site, attempt.id, learnerA)]);
    assert.ok(["answer_locked", "attempt_already_submitted"].includes(answer.error?.code));
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.correctAnswers, accepted.selectedIndex === key.correct ? 1 : 0);
    assert.equal(Number(rows(site, "SELECT answer_index FROM assessment_attempt_items WHERE id = ?", [questionId])[0].answer_index), accepted.selectedIndex);
    const retry = await submitProcess(site, attempt.id, learnerA);
    assert.deepEqual(retry, submitted, "retries retain the committed grade and submission time");
  });
});

test("A18 an interrupted response is recoverable by reading the attempt", async () => {
  const { site } = await setup("a18");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 12, requestKey: randomUUID() })).json.data.attempt;
    const entry = attemptKey(site, attempt.id).get(attempt.questions[0].id);
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: entry.correct });
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    const recovered = await learner.get(`/api/assessments/attempts/${attempt.id}`);
    assert.equal(recovered.json.data.attempt.status, "submitted");
    assert.equal(recovered.json.data.attempt.result.passed, true);
  });
});

/* ------------------------------------------------- acknowledgement, practice, time */

test("A19 a no-quiz module completes on a server-recorded acknowledgement, idempotently", async () => {
  const { site } = await setup("a19");
  bulk(site, { modules: [{ module_number: 98, sort_order: 98 }] });
  await withSite(site, async (api) => {
    // Q05: legitimate optional/no-quiz content belongs to an explicit disposable
    // policy. Keep immutable v1 untouched rather than weakening assigned membership.
    const admin = await signIn(api.port, "pengelola@example.test");
    const created = await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" });
    const policy = created.json.data.policy;
    const saved = await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", { ...policy, expectedDraftVersion: policy.draftVersion, modules: [...policy.modules, { moduleNumber: 98, required: false, assessmentMode: "acknowledgement" }] });
    assert.equal(saved.status, 200, saved.text);
    const token = saved.json.data.policy.draftVersion;
    assert.equal((await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/validate", { expectedDraftVersion: token })).json.data.valid, true);
    assert.equal((await admin.mutate("POST", "/api/admin/curriculum/policies/academy-v2/ready", { expectedDraftVersion: token })).status, 200);
    const activated = run(site, join(repo, "scripts", "curriculum", "activate-policy.php"), ["--policy-version=academy-v2", "--expect-environment=local", "--apply", "--operator=Test", "--evidence-ref=A19"]);
    assert.equal(activated.status, 0, activated.stdout + activated.stderr);
    // Test-only assignment of this disposable learner; production has no reassignment API.
    sql(site, "INSERT INTO learner_curriculum_assignments (user_id, policy_version, assigned_at, assignment_source) SELECT id, 'academy-v2', CURRENT_TIMESTAMP, 'test_fixture' FROM users WHERE email = 'peserta-a@example.test' ON CONFLICT(user_id) DO UPDATE SET policy_version = 'academy-v2'");
    const learner = await signIn(api.port, "peserta-a@example.test");
    const first = await learner.mutate("POST", "/api/modules/98/acknowledge", {});
    assert.equal(first.status, 200);
    assert.equal(first.json.data.progress.completed, true);
    assert.equal(first.json.data.progress.completionStatus, "completed_verified");
    const again = await learner.mutate("POST", "/api/modules/98/acknowledge", {});
    assert.equal(again.status, 200);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_learning_events WHERE module_number = 98")[0].n), 1);
  });
});

test("A20 practice is self-attested and never changes academic completion", async () => {
  const { site } = await setup("a20");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attested = await learner.mutate("POST", "/api/modules/13/practice", { attested: true, requestKey: randomUUID() });
    assert.equal(attested.json.data.progress.practicalDone, true);
    assert.equal(attested.json.data.progress.completed, false);
    const withdrawn = await learner.mutate("POST", "/api/modules/13/practice", { attested: false, requestKey: randomUUID() });
    assert.equal(withdrawn.json.data.progress.practicalDone, false);
    const malformed = await learner.mutate("POST", "/api/modules/13/practice", { attested: "yes", requestKey: randomUUID() });
    assert.equal(malformed.status, 422);
  });
});

test("A21 a replayed study-time increment is counted once; A22 client totals are refused", async () => {
  const { site } = await setup("a21");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const key = randomUUID();
    await learner.mutate("POST", "/api/modules/14/study-time", { minutes: 5, requestKey: key });
    const replay = await learner.mutate("POST", "/api/modules/14/study-time", { minutes: 5, requestKey: key });
    assert.equal(replay.json.data.progress.timeSpentMinutes, 5, "a retry must not double-count");

    const total = await learner.mutate("POST", "/api/modules/14/study-time", { timeSpentMinutes: 999, requestKey: randomUUID() });
    assert.equal(total.status, 422);
    assert.equal(total.json.error.code, "academic_field_forbidden");

    const tooLarge = await learner.mutate("POST", "/api/modules/14/study-time", { minutes: 16, requestKey: randomUUID() });
    assert.equal(tooLarge.json.error.code, "study_increment_invalid", "increments are capped at 15 minutes");
  });
});

/* ------------------------------------------------------------ final exam */

test("A23 the final exam refuses a learner who has not verified every required module", async () => {
  const { site } = await setup("a23");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const start = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() });
    assert.equal(start.status, 409);
    assert.equal(start.json.error.code, "final_prerequisites_unmet");
    assert.equal(start.json.error.details.missingModuleNumbers.length, 22);
    const eligibility = await learner.get("/api/assessments/final-eligibility");
    assert.equal(eligibility.json.data.eligible, false);
  });
});

test("A24 and A25 with every module verified, the final starts; answers stay ungraded until submission", async () => {
  const { site } = await setup("a24");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passAllRequired(learner, site);
    const eligibility = await learner.get("/api/assessments/final-eligibility");
    assert.equal(eligibility.json.data.eligible, true);
    const start = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() });
    assert.equal(start.status, 201);
    const attempt = start.json.data.attempt;
    assert.equal(attempt.totalQuestions, 6);
    const saved = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: 0 });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.data.saved, true);
    assert.ok(!saved.text.includes("correctIndex") && !saved.text.includes("feedback"));
    const view = await learner.get(`/api/assessments/attempts/${attempt.id}`);
    assert.ok(!view.text.includes("correctIndex"), "no answer key before submission");
  });
});

test("A26 to A28 at exactly 79% the final fails and at exactly 80% it passes, with no answer key afterwards", async () => {
  const site = makeSite("a26");
  seedCurriculum(site);
  // 100 questions in total: the six seeded final questions plus 94 added here.
  bulk(site, {
    questions: Array.from({ length: 94 }, (_, index) => ({ module_number: 0, options: ["A", "B", "C", "D"], learning_objective: `Tujuan ${index % 4}` })),
  });
  seedAccount(site, { email: "gagal@example.test", verified: true });
  seedAccount(site, { email: "lulus@example.test", verified: true });

  await withSite(site, async (api) => {
    const failing = await signIn(api.port, "gagal@example.test");
    await passAllRequired(failing, site);
    const attempt = (await failing.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
    assert.equal(attempt.totalQuestions, 100);
    await answerFinal(failing, site, attempt, 79);
    const submitted = await failing.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.json.data.attempt.result.scorePercent, 79);
    assert.equal(submitted.json.data.attempt.result.passed, false);
    assert.ok(!submitted.text.includes("correctIndex"), "no answer key in a failed result");
    assert.ok(!submitted.text.includes("explanation"));
    assert.notEqual(submitted.json.data.attempt.result.objectives, undefined, "only an objective-level summary is returned");
    const after = await failing.get(`/api/assessments/attempts/${attempt.id}`);
    assert.ok(!after.text.includes("correctIndex"));
    assert.equal((await failing.get("/api/assessments/final-eligibility")).json.data.finalStatus, "failed");
  });

  await withSite(site, async (api) => {
    const passing = await signIn(api.port, "lulus@example.test");
    await passAllRequired(passing, site);
    const attempt = (await passing.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
    await answerFinal(passing, site, attempt, 80);
    const submitted = await passing.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.json.data.attempt.result.scorePercent, 80);
    assert.equal(submitted.json.data.attempt.result.passed, true, "80% exactly meets the final threshold");
    assert.equal((await passing.get("/api/assessments/final-eligibility")).json.data.finalStatus, "passed");
  });
});

test("A29 a fourth final attempt within 24 hours is rate-limited with the next eligible time", async () => {
  const { site } = await setup("a29");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passAllRequired(learner, site);
    for (let number = 1; number <= 3; number++) {
      const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
      await answerFinal(learner, site, attempt, 0);
      const submitted = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
      assert.equal(submitted.status, 200, submitted.text);
    }
    const limited = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() });
    assert.equal(limited.status, 429);
    assert.equal(limited.json.error.code, "assessment_rate_limited");
    assert.ok(limited.json.error.details.nextEligibleAt, "the next eligible time is shown");
  });
});

test("A30 an active final attempt is resumed without consuming another attempt", async () => {
  const { site } = await setup("a30");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passAllRequired(learner, site);
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
    await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[0].id, answerIndex: 1 });
    const resumed = await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.json.data.created, false);
    assert.equal(resumed.json.data.attempt.id, attempt.id);
    assert.equal(resumed.json.data.attempt.questions[0].selectedIndex, 1, "the saved selection survives a resume");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE assessment_type = 'final_exam'")[0].n), 1);
  });
});

/* ------------------------------------------------------- legacy and boundaries */

test("A31 and A32 legacy completion is preserved as legacy and never satisfies final eligibility", async () => {
  const { site } = await setup("a31");
  const legacyLearner = seedAccount(site, { email: "lama@example.test", verified: true });
  sql(site, "INSERT INTO user_progress (user_id, module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes) VALUES (?, 1, 1, 1, 1, 1, 42)", [legacyLearner]);
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "lama@example.test");
    const row = await progressRow(learner, 1);
    assert.equal(row.completed, false, "historical booleans do not count as academic completion");
    assert.equal(row.legacyCompleted, true);
    assert.equal(row.verificationStatus, "legacy_unverified");
    assert.equal(row.legacyTimeSpentMinutes, 42);
    assert.equal(row.timeSpentMinutes, 42, "historical study time is preserved");
    const eligibility = await learner.get("/api/assessments/final-eligibility");
    assert.ok(eligibility.json.data.missingModuleNumbers.includes(1));
  });
});

test("A33 and A34 the insecure certificate endpoint is disabled and existing reads still work", async () => {
  const { site } = await setup("a33");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const issued = await learner.mutate("POST", "/api/certificates", { levelNumber: 1, levelName: "Palsu", score: 100, examType: "final" });
    assert.equal(issued.status, 410);
    assert.equal(issued.json.error.code, "certificate_endpoint_retired");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificates")[0].n), 0, "no certificate was created");
    const list = await learner.get("/api/certificates");
    assert.equal(list.status, 200);
  });
});

test("A35 and A36 administrators keep admin access; learners are refused the same surface", async () => {
  const { site } = await setup("a35");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    const learner = await signIn(api.port, "peserta-a@example.test");
    assert.equal((await admin.get("/api/admin/learners")).status, 200);
    assert.equal((await learner.get("/api/admin/learners")).status, 403);
  });
});

test("A37 and A38 migration on a populated database keeps every row and replays idempotently", async () => {
  const { site } = await setup("a37");
  const legacyLearner = seedAccount(site, { email: "populasi@example.test", verified: true });
  sql(site, "INSERT INTO user_progress (user_id, module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes) VALUES (?, 2, 1, 1, 1, 0, 9)", [legacyLearner]);
  const before = Number(rows(site, "SELECT COUNT(*) AS n FROM user_progress")[0].n);
  const first = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const second = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Assessment schema: present/);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM user_progress")[0].n), before, "no legacy progress row was lost");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM legacy_progress_snapshots")[0].n), before, "every legacy row is snapshotted exactly once");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM schema_migrations WHERE migration_key = ?", ["20261015_assessment_authority_v1"])[0].n), 1);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_policies WHERE policy_version = 'academy-v1'")[0].n), 1);
});

test("npm test runs the Q01, Q02 and Q03 suites together", () => {
  const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /q01-environment-artifact/);
  assert.match(pkg.scripts.test, /q02-authz/);
  assert.match(pkg.scripts.test, /q03-assessment/);
});

test("A43 the progress read model agrees with the verified-completion count", async () => {
  const { site } = await setup("a43");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 1);
    await passModule(learner, site, 2);
    const progress = await learner.get("/api/progress");
    const verified = progress.json.data.filter((row) => row.completed).length;
    const eligibility = await learner.get("/api/assessments/final-eligibility");
    assert.equal(verified, eligibility.json.data.verifiedCompletedCount);
  });
});

test("the 70% module boundary: 6 of 10 fails and 7 of 10 passes", async () => {
  const { site } = await setup("boundary70");
  // Exercise grading on an assigned v1 member. A post-seed module is not
  // automatically part of the learner's immutable academic contract.
  sql(site, "DELETE FROM quiz_questions WHERE module_number = 1");
  bulk(site, {
    questions: Array.from({ length: 10 }, () => ({ module_number: 1, correct_index: 0 })),
  });
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const attempt = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 1, requestKey: randomUUID() })).json.data.attempt;
    for (let index = 0; index < 10; index++) {
      await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[index].id, answerIndex: index < 6 ? 0 : 1 });
    }
    const failed = await learner.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal(failed.json.data.attempt.result.scorePercent, 60);
    assert.equal(failed.json.data.attempt.result.passed, false);

    const retake = (await learner.mutate("POST", "/api/assessments/attempts", { assessmentType: "module_quiz", moduleNumber: 1, requestKey: randomUUID() })).json.data.attempt;
    for (let index = 0; index < 10; index++) {
      await learner.mutate("POST", `/api/assessments/attempts/${retake.id}/answers`, { questionId: retake.questions[index].id, answerIndex: index < 7 ? 0 : 1 });
    }
    const passed = await learner.mutate("POST", `/api/assessments/attempts/${retake.id}/submit`, { requestKey: randomUUID() });
    assert.equal(passed.json.data.attempt.result.scorePercent, 70);
    assert.equal(passed.json.data.attempt.result.passed, true, "70% exactly meets the module threshold");
  });
});

test("admin readers count only verified completions; a historical row never counts; reset keeps the evidence", async () => {
  const { site, learnerA } = await setup("admin-read");
  const legacyId = seedAccount(site, { email: "lama-admin@example.test", verified: true });
  sql(site, "INSERT INTO user_progress (user_id, module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes) VALUES (?, 1, 1, 1, 1, 1, 42)", [legacyId]);
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passModule(learner, site, 1);
    const admin = await signIn(api.port, "pengelola@example.test");

    const list = await admin.get("/api/admin/learners");
    const byEmail = Object.fromEntries(list.json.data.learners.map((row) => [row.email, row]));
    assert.equal(byEmail["peserta-a@example.test"].completedModules, 1, "the verified pass is counted");
    assert.equal(byEmail["lama-admin@example.test"].completedModules, 0, "a historical boolean is not a completion");
    assert.equal(byEmail["lama-admin@example.test"].progressEntries, 1, "the historical record stays visible as an entry");

    const detail = await admin.get(`/api/admin/learners/${legacyId}`);
    const legacyRow = detail.json.data.progress.find((row) => row.moduleNumber === 1);
    assert.equal(legacyRow.completed, false);
    assert.equal(legacyRow.timeSpentMinutes, 42, "historical study time is preserved");

    const reset = await admin.mutate("DELETE", `/api/admin/users/${learnerA}/progress`, { confirm: true });
    assert.equal(reset.status, 200, reset.text);
    assert.equal(reset.json.data.reset.generationTo, 2);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE user_id = ?", [learnerA])[0].n), 1, "the passing attempt is kept as history");
    const afterReset = await admin.get("/api/admin/learners");
    assert.equal(Object.fromEntries(afterReset.json.data.learners.map((row) => [row.email, row]))["peserta-a@example.test"].completedModules, 0);

    const legacyReset = await admin.mutate("DELETE", `/api/admin/users/${legacyId}/progress`, { confirm: true });
    assert.equal(legacyReset.status, 200, legacyReset.text);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM user_progress WHERE user_id = ?", [legacyId])[0].n), 1, "imported rows are retained, not deleted");
    const legacyDetail = await admin.get(`/api/admin/learners/${legacyId}`);
    assert.equal(legacyDetail.json.data.progress.length, 0, "a later generation starts without the historical rows");
  });
});

/* ------------------------------------------- not run in this environment */

test("A41, A42 and A44 browser flows at 390px and on desktop", { skip: "NOT_TESTED: no browser run was executed for Q03" }, () => {});

if (!process.env.AAPM_TEST_MYSQL_CONFIG) test("MySQL row locking for answer and submit paths", { skip: "Default SQLite suite; actual native answer/submit races run through npm run test:q03-q04:mysql" }, () => {});
