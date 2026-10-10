// Shared disposable-site harness for the Q03/Q04 suites: real API under php -S,
// disposable SQLite, config outside the docroot. Nothing here touches staging or production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const fixtures = join(repo, "tests", "fixtures");
export const SQLITE = ["-d", "extension=php_pdo_sqlite.dll", "-d", "extension=php_sqlite3.dll", "-d", "extension=php_pdo_mysql.dll"];
export const PASSWORD = "Valid-pass1";
export const created = [];
export function cleanup() {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
}


export function scratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `aapm-q03-${name}-`));
  created.push(dir);
  return dir;
}

export function cleanEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("AAPLAYERACADEMY_") && !key.startsWith("AAPM_")) env[key] = value;
  }
  return { ...env, ...extra };
}

export const forward = (path) => path.replace(/\\/g, "/");

export function phpLiteral(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function phpHash(password) {
  return spawnSync("php", ["-r", "echo password_hash($argv[1], PASSWORD_DEFAULT);", password], {
    encoding: "utf8",
    env: cleanEnv(),
  }).stdout;
}

/** A disposable local site: SQLite, dev token exposure, no mail transport. */
export function makeSite(name, overrides = {}) {
  const root = scratch(name);
  const dbPath = join(root, "app.sqlite");
  writeFileSync(dbPath, "");
  let mysql = {};
  if (process.env.AAPM_TEST_MYSQL_CONFIG) {
    const privatePath = process.env.AAPM_TEST_MYSQL_CONFIG;
    const privateConfig = JSON.parse(readFileSync(privatePath, "utf8"));
    assert.equal(privateConfig.taskOwned, true, "Only a task-owned database runtime is allowed");
    assert.equal(privateConfig.host, "127.0.0.1");
    assert.match(privateConfig.databasePrefix, /^aapm_q05_test_$/);
    const database = privateConfig.databasePrefix + randomUUID().replaceAll("-", "");
    const createdDb = spawnSync("php", [...SQLITE, join(fixtures, "q05", "mysql-create.php"), database], {
      cwd: repo, encoding: "utf8", env: cleanEnv({ AAPM_TEST_MYSQL_CONFIG: privatePath }),
    });
    assert.equal(createdDb.status, 0, "Task database creation failed (credentials withheld)");
    mysql = { db_driver: "mysql", db_host: privateConfig.host, db_port: privateConfig.port, db_name: database, db_user: privateConfig.testUser, db_password: privateConfig.testPassword };
  }
  const settings = {
    environment: "local",
    task_owned_fixture: true,
    db_driver: "sqlite",
    db_path: forward(dbPath),
    app_url: "http://127.0.0.1",
    expose_dev_reset_token: true,
    mail_from: "",
    environment_marker_required: false,
    admin_emails: "",
    ...mysql,
    ...overrides,
  };
  const body = Object.entries(settings).map(([key, value]) => `    '${key}' => ${phpLiteral(value)},`).join("\n");
  const config = join(root, "config.php");
  writeFileSync(config, `<?php\nreturn [\n${body}\n];\n`);
  return { root, dbPath, config, driver: settings.db_driver };
}

export function run(site, script, args) {
  return spawnSync("php", [...SQLITE, script, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
}

export function sql(site, text, params = []) {
  const result = run(site, join(fixtures, "q02", "sql.php"), [JSON.stringify({ sql: text, params })]);
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout;
}

export function rows(site, text, params = []) {
  return JSON.parse(sql(site, text, params));
}

export function seedCurriculum(site) {
  // The shipped seed: 22 required modules, one quiz question each, and the final-exam questions (module 0).
  const result = spawnSync("php", [...SQLITE, join(repo, "database", "seed.php")], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

export function bulk(site, spec) {
  const result = run(site, join(fixtures, "q03", "bulk.php"), [JSON.stringify(spec)]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

export function seedAccount(site, { email, role = "user", verified = false, password = PASSWORD, name = "Peserta Uji" }) {
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
export function attemptKey(site, publicId) {
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

export const wrongIndex = (entry) => (entry.correct + 1) % entry.count;

export function freePort() {
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
export class Api {
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

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function startSite(site) {
  const port = await freePort();
  let stderr = "";
  const child = spawn("php", [...SQLITE, "-S", `127.0.0.1:${port}`, "-t", "public", join("public", "router.php")], {
    cwd: repo,
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => (stderr += chunk));
  for (let attempt = 0; attempt < 600; attempt++) {
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

export async function withSite(site, run) {
  const server = await startSite(site);
  try {
    return await run(new Api(server.port));
  } finally {
    server.stop();
  }
}

export async function signIn(port, email, password = PASSWORD) {
  const api = new Api(port);
  const reply = await api.mutate("POST", "/api/auth/login", { email, password });
  assert.equal(reply.status, 200, reply.text);
  return api;
}

/** Seeded curriculum plus one learner; the admin account is used only by the admin test. */
export async function setup(name) {
  const site = makeSite(name);
  seedCurriculum(site);
  const learnerA = seedAccount(site, { email: "peserta-a@example.test", verified: true });
  seedAccount(site, { email: "peserta-b@example.test", verified: true });
  seedAccount(site, { email: "pengelola@example.test", role: "super_admin", verified: true });
  return { site, learnerA };
}

/** Starts a module quiz, answers its one question correctly, and submits it. */
export async function passModule(api, site, moduleNumber) {
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

export async function passAllRequired(api, site) {
  for (let number = 1; number <= 22; number++) {
    await passModule(api, site, number);
  }
}

/** Answers a final exam: the first `correctCount` items correctly, the rest wrongly. */
export async function answerFinal(api, site, attempt, correctCount) {
  const key = attemptKey(site, attempt.id);
  for (let index = 0; index < attempt.questions.length; index++) {
    const entry = key.get(attempt.questions[index].id);
    const answerIndex = index < correctCount ? entry.correct : wrongIndex(entry);
    const saved = await api.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[index].id, answerIndex });
    assert.equal(saved.status, 200, saved.text);
  }
}

export async function progressRow(api, moduleNumber) {
  const reply = await api.get("/api/progress");
  return reply.json.data.find((row) => row.moduleNumber === moduleNumber) ?? null;
}

/** Runs one submit as its own PHP process, so two submits can race on the same SQLite file. */
export function submitProcess(site, publicId, userId) {
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

