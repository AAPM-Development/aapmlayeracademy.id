// Q02 regression suite: verified identity, server-side authorization, session
// revocation, CLI-only administrator provisioning, and the security audit.
// Runs the real API under `php -S` against disposable SQLite databases and
// separate PHP processes for the races. Nothing touches staging or production.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "tests", "fixtures", "q02");
const SQLITE = ["-d", "extension=php_pdo_sqlite.dll", "-d", "extension=php_sqlite3.dll"];
const PASSWORD = "Valid-pass1";
const created = [];

after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

function scratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `aapm-q02-${name}-`));
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
  const result = spawnSync("php", ["-r", "echo password_hash($argv[1], PASSWORD_DEFAULT);", password], {
    encoding: "utf8",
    env: cleanEnv(),
  });
  return result.stdout;
}

/** A disposable local site: SQLite, dev token exposure, no mail transport. */
function makeSite(name, overrides = {}) {
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

function sql(site, text, params = []) {
  const result = spawnSync("php", [...SQLITE, join(fixtures, "sql.php"), JSON.stringify({ sql: text, params })], {
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout;
}

function rows(site, text, params = []) {
  return JSON.parse(sql(site, text, params));
}

function seedAccount(site, { email, role = "user", verified = false, pending = false, password = PASSWORD, name = "Peserta Uji" }) {
  sql(
    site,
    "INSERT INTO users (email, password_hash, full_name, role, email_verified_at, verification_required_at, auth_version) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [
      email,
      phpHash(password),
      name,
      role,
      verified ? "2026-10-01 00:00:00" : null,
      pending ? "2026-10-01 00:00:00" : null,
    ]
  );
  return Number(rows(site, "SELECT id FROM users WHERE email = ?", [email])[0].id);
}

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
    return { status: response.status, json, text, location: response.headers.get("location") };
  }

  get(path) {
    return this.raw("GET", path);
  }

  async mutate(method, path, body) {
    const csrf = await this.raw("GET", "/api/auth/csrf");
    return this.raw(method, path, body, { "x-csrf-token": csrf.json.data.csrfToken });
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function startSite(site, extraEnv = {}) {
  const port = await freePort();
  let stderr = "";
  const child = spawn("php", [...SQLITE, "-S", `127.0.0.1:${port}`, "-t", "public", join("public", "router.php")], {
    cwd: repo,
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config, ...extraEnv }),
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => (stderr += chunk));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`php server exited: ${stderr}`);
    try {
      await new Api(port).get("/api/health");
      return { port, api: new Api(port), stop: () => child.kill() };
    } catch {
      await sleep(100);
    }
  }
  child.kill();
  throw new Error("php server did not start");
}

async function withSite(site, run, extraEnv = {}) {
  const server = await startSite(site, extraEnv);
  try {
    return await run(server.api, server);
  } finally {
    server.stop();
  }
}

function cli(site, script, args) {
  return spawnSync("php", [...SQLITE, join(repo, script), ...args], {
    cwd: repo,
    encoding: "utf8",
    env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
  });
}

function concurrent(site, commands) {
  return Promise.all(
    commands.map(
      (args) =>
        new Promise((done) => {
          const child = spawn("php", [...SQLITE, ...args], {
            cwd: repo,
            env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
          });
          let out = "";
          child.stdout.on("data", (chunk) => (out += chunk));
          child.on("close", (code) => done({ code, out: out.trim() }));
        })
    )
  );
}

const login = (api, email, password) => api.mutate("POST", "/api/auth/login", { email, password });

async function registerAndGetToken(api, email) {
  const reply = await api.mutate("POST", "/api/auth/register", { email, password: PASSWORD, fullName: "Peserta" });
  assert.equal(reply.status, 202);
  return reply.json.data.devVerificationToken;
}

/* ----------------------------------------------------------- registration */

test("registration is generic, creates no session, and never overwrites an existing account", async () => {
  const site = makeSite("signup");
  await withSite(site, async (api) => {
    const first = await api.mutate("POST", "/api/auth/register", { email: "peserta@example.test", password: PASSWORD, fullName: "Peserta" });
    assert.equal(first.status, 202);
    assert.equal(first.json.data.status, "accepted");
    assert.ok(first.json.data.devVerificationToken, "local dev exposure only");
    assert.equal((await api.get("/api/auth/me")).status, 401, "registration must not create a session");

    const second = await api.mutate("POST", "/api/auth/register", { email: "peserta@example.test", password: "Other-pass2", fullName: "Lain" });
    assert.equal(second.status, 202);
    assert.equal(second.json.data.message, first.json.data.message, "same acknowledgment for an existing address");
    assert.equal(second.json.data.devVerificationToken, undefined, "an existing address yields no token");
    assert.equal((await login(api, "peserta@example.test", PASSWORD)).json.error.code, "email_verification_required", "original password still identifies the account");
    assert.equal((await login(api, "peserta@example.test", "Other-pass2")).json.error.code, "invalid_credentials", "the second signup changed nothing");
  });
});

test("a pending account gets no session until its token is consumed, and the token works exactly once", async () => {
  const site = makeSite("verify-once");
  await withSite(site, async (api) => {
    const token = await registerAndGetToken(api, "baru@example.test");
    const refused = await login(api, "baru@example.test", PASSWORD);
    assert.equal(refused.status, 403);
    assert.equal(refused.json.error.code, "email_verification_required");
    assert.equal((await api.get("/api/auth/me")).status, 401);

    const verified = await api.mutate("POST", "/api/auth/verify-email", { token });
    assert.equal(verified.status, 200);
    assert.equal(verified.json.data.user.emailVerificationStatus, "verified");
    assert.equal(verified.json.data.user.canAccessAdmin, false);

    const replay = await api.mutate("POST", "/api/auth/verify-email", { token });
    assert.equal(replay.status, 400);
    assert.equal(replay.json.error.code, "invalid_verification_token");
    assert.equal((await api.get("/api/auth/me")).status, 200, "the verifying browser is signed in");
  });
});

test("an expired verification token is refused", async () => {
  const site = makeSite("expired");
  await withSite(site, async (api) => {
    const token = await registerAndGetToken(api, "lama@example.test");
    sql(site, "UPDATE email_verification_tokens SET expires_at = ?", ["2000-01-01 00:00:00"]);
    const reply = await api.mutate("POST", "/api/auth/verify-email", { token });
    assert.equal(reply.status, 400);
    assert.equal(reply.json.error.code, "invalid_verification_token");
  });
});

test("resending verification supersedes the earlier token, and a wrong password reveals nothing", async () => {
  const site = makeSite("resend");
  await withSite(site, async (api) => {
    const first = await registerAndGetToken(api, "ulang@example.test");
    const wrong = await api.mutate("POST", "/api/auth/resend-verification", { email: "ulang@example.test", password: "Wrong-pass9" });
    assert.equal(wrong.status, 202);
    assert.equal(wrong.json.data.devVerificationToken, undefined, "a wrong password gets no token");

    const resent = await api.mutate("POST", "/api/auth/resend-verification", { email: "ulang@example.test", password: PASSWORD });
    assert.equal(resent.status, 202);
    const second = resent.json.data.devVerificationToken;
    assert.ok(second && second !== first);

    assert.equal((await api.mutate("POST", "/api/auth/verify-email", { token: first })).status, 400, "earlier token is superseded");
    assert.equal((await api.mutate("POST", "/api/auth/verify-email", { token: second })).status, 200);
  });
});

test("a configured administrator email never grants administration", async () => {
  const site = makeSite("config-admin", { admin_emails: "boss@example.test" });
  await withSite(site, async (api) => {
    const token = await registerAndGetToken(api, "boss@example.test");
    const verified = await api.mutate("POST", "/api/auth/verify-email", { token });
    assert.equal(verified.json.data.user.role, "learner");
    assert.equal(verified.json.data.user.canAccessAdmin, false);
    const admin = await api.get("/api/admin/users");
    assert.equal(admin.status, 403);
    assert.equal(admin.json.error.code, "admin_required");
  }, {});
});

test("legacy learners keep access, and a legacy administrator without verification is refused admin APIs", async () => {
  const site = makeSite("legacy");
  seedAccount(site, { email: "lama-belajar@example.test" });
  seedAccount(site, { email: "lama-admin@example.test", role: "admin" });
  await withSite(site, async (api) => {
    const learner = await login(api, "lama-belajar@example.test", PASSWORD);
    assert.equal(learner.status, 200);
    assert.equal(learner.json.data.user.emailVerificationStatus, "legacy_pending");
    assert.equal((await api.get("/api/auth/me")).status, 200);

    const legacyAdmin = new Api(api.port);
    const signedIn = await login(legacyAdmin, "lama-admin@example.test", PASSWORD);
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.json.data.user.role, "learner", "stored admin without verification is not an administrator");
    assert.equal((await legacyAdmin.get("/api/admin/users")).status, 403);
  });
});

/* -------------------------------------------------------- CLI provisioning */

test("CLI provisioning: dry-run is inert, apply grants verified administration, and repeated apply is idempotent", async () => {
  const site = makeSite("provision");
  const id = seedAccount(site, { email: "operator@example.test", role: "admin" });
  const dry = cli(site, "scripts/security/provision-admin.php", ["--expect-environment=local", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /wouldChange: yes/);
  assert.equal(rows(site, "SELECT email_verified_at FROM users WHERE id = ?", [id])[0].email_verified_at, null, "dry-run changes nothing");

  const applied = cli(site, "scripts/security/provision-admin.php", ["--expect-environment=local", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply"]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /result: provisioned/);
  assert.notEqual(rows(site, "SELECT email_verified_at FROM users WHERE id = ?", [id])[0].email_verified_at, null);

  await withSite(site, async (api) => {
    assert.equal((await login(api, "operator@example.test", PASSWORD)).status, 200);
    assert.equal((await api.get("/api/admin/users")).status, 200, "provisioned administrator reaches admin APIs");
  });

  const again = cli(site, "scripts/security/provision-admin.php", ["--expect-environment=local", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply"]);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /result: already_provisioned/);
});

test("CLI provisioning refuses a wrong target, weak evidence, an email as target, a missing account, and an absent marker", async () => {
  const site = makeSite("provision-refuse");
  const id = seedAccount(site, { email: "tamu@example.test" });
  const before = rows(site, "SELECT role, email_verified_at FROM users WHERE id = ?", [id])[0];
  const refusals = [
    [["--expect-environment=staging", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply"], 2],
    [["--expect-environment=local", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=x", "--apply"], 2],
    [["--expect-environment=local", "--user-id=tamu@example.test", "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply"], 2],
    [["--expect-environment=local", "--user-id=424242", "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply"], 1],
    [["--expect-environment=local", `--user-id=${id}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--apply", "--dry-run"], 2],
  ];
  for (const [args, expected] of refusals) {
    const result = cli(site, "scripts/security/provision-admin.php", args);
    assert.equal(result.status, expected, `${args.join(" ")} => ${result.stdout}${result.stderr}`);
  }
  assert.deepEqual(rows(site, "SELECT role, email_verified_at FROM users WHERE id = ?", [id])[0], before, "no refused attempt changed the account");

  // Seed first, then require the marker: the real order, since the marker check guards every database read.
  const marked = makeSite("provision-marker");
  const markedId = seedAccount(marked, { email: "marker@example.test" });
  writeFileSync(marked.config, readFileSync(marked.config, "utf8").replace("'environment_marker_required' => false", "'environment_marker_required' => true"));
  const result = cli(marked, "scripts/security/provision-admin.php", ["--expect-environment=local", `--user-id=${markedId}`, "--actor=op-one", "--evidence-ref=SEC-APPROVAL-001", "--dry-run"]);
  assert.equal(result.status, 1, "a missing environment marker refuses before reading the account");
  assert.match(result.stderr, /penanda lingkungan|environment_marker_missing/);
});

/* ------------------------------------------------------ authority and roles */

test("learners cannot reach admin APIs or escalate through a payload, and mutations need CSRF", async () => {
  const site = makeSite("escalation");
  const adminId = seedAccount(site, { email: "admin-terverifikasi@example.test", role: "admin", verified: true });
  seedAccount(site, { email: "peserta-biasa@example.test", verified: true });
  await withSite(site, async (api) => {
    const learner = new Api(api.port);
    assert.equal((await login(learner, "peserta-biasa@example.test", PASSWORD)).status, 200);
    const escalate = await learner.mutate("PUT", `/api/admin/users/${adminId}`, { role: "admin" });
    assert.equal(escalate.status, 403);
    assert.equal(escalate.json.error.code, "admin_required");
    assert.equal((await learner.mutate("POST", "/api/admin/users", { email: "x@example.test", password: PASSWORD, fullName: "X", role: "admin" })).status, 403);

    const admin = new Api(api.port);
    assert.equal((await login(admin, "admin-terverifikasi@example.test", PASSWORD)).status, 200);
    const noCsrf = await admin.raw("PUT", `/api/admin/users/${adminId}`, { role: "admin" });
    assert.equal(noCsrf.status, 419);
    assert.equal(noCsrf.json.error.code, "csrf_failed");
  });
});

test("demoting an administrator revokes that administrator's active session", async () => {
  const site = makeSite("demote-session");
  const aId = seedAccount(site, { email: "a@example.test", role: "admin", verified: true });
  const bId = seedAccount(site, { email: "b@example.test", role: "admin", verified: true });
  await withSite(site, async (api) => {
    const adminA = new Api(api.port);
    const adminB = new Api(api.port);
    assert.equal((await login(adminA, "a@example.test", PASSWORD)).status, 200);
    assert.equal((await login(adminB, "b@example.test", PASSWORD)).status, 200);
    assert.equal((await adminB.get("/api/admin/users")).status, 200);

    const demoted = await adminA.mutate("PUT", `/api/admin/users/${bId}`, { role: "learner" });
    assert.equal(demoted.status, 200);
    assert.equal(demoted.json.data.user.role, "learner");

    const revoked = await adminB.get("/api/auth/me");
    assert.equal(revoked.status, 401);
    assert.equal(revoked.json.error.code, "session_revoked");
    assert.equal((await adminB.get("/api/admin/users")).status, 401, "old admin access is gone");
    assert.ok(aId > 0);
  });
});

test("an administrator password reset revokes the target's sessions and replaces the password", async () => {
  const site = makeSite("admin-reset");
  seedAccount(site, { email: "pengelola@example.test", role: "admin", verified: true });
  const learnerId = seedAccount(site, { email: "peserta-reset@example.test", verified: true });
  await withSite(site, async (api) => {
    const admin = new Api(api.port);
    const learner = new Api(api.port);
    assert.equal((await login(admin, "pengelola@example.test", PASSWORD)).status, 200);
    assert.equal((await login(learner, "peserta-reset@example.test", PASSWORD)).status, 200);

    const reset = await admin.mutate("PUT", `/api/admin/users/${learnerId}/password`, { password: "New-pass3" });
    assert.equal(reset.status, 200);
    assert.equal((await learner.get("/api/auth/me")).json.error.code, "session_revoked");
    assert.equal((await login(new Api(api.port), "peserta-reset@example.test", PASSWORD)).json.error.code, "invalid_credentials");
    assert.equal((await login(new Api(api.port), "peserta-reset@example.test", "New-pass3")).status, 200);
  });
});

test("password recovery revokes old sessions and proves control of the email address", async () => {
  const site = makeSite("recovery");
  seedAccount(site, { email: "pemulihan@example.test", pending: true });
  await withSite(site, async (api) => {
    const pending = await login(new Api(api.port), "pemulihan@example.test", PASSWORD);
    assert.equal(pending.json.error.code, "email_verification_required");

    const legacy = makeSite("recovery-legacy");
    seedAccount(legacy, { email: "pemulihan-lama@example.test" });
    await withSite(legacy, async (legacyApi) => {
      const session = new Api(legacyApi.port);
      assert.equal((await login(session, "pemulihan-lama@example.test", PASSWORD)).status, 200);
      const forgot = await legacyApi.mutate("POST", "/api/auth/forgot-password", { email: "pemulihan-lama@example.test" });
      const resetToken = forgot.json.data.devResetToken;
      assert.ok(resetToken);
      const reset = await legacyApi.mutate("POST", "/api/auth/reset-password", { token: resetToken, newPassword: "Reset-pass4" });
      assert.equal(reset.status, 200);
      assert.equal((await session.get("/api/auth/me")).json.error.code, "session_revoked");
      const state = rows(legacy, "SELECT email_verified_at FROM users WHERE email = ?", ["pemulihan-lama@example.test"])[0];
      assert.notEqual(state.email_verified_at, null, "emailed reset proves ownership");
    });
  });
});

test("administrators cannot demote themselves", async () => {
  const site = makeSite("self-demotion");
  const id = seedAccount(site, { email: "diri-sendiri@example.test", role: "admin", verified: true });
  await withSite(site, async (api) => {
    const admin = new Api(api.port);
    assert.equal((await login(admin, "diri-sendiri@example.test", PASSWORD)).status, 200);
    const reply = await admin.mutate("PUT", `/api/admin/users/${id}`, { role: "learner" });
    assert.equal(reply.status, 422);
    assert.equal(reply.json.error.code, "self_demotion");
  });
});

test("the last verified administrator cannot be demoted, even by a direct call", async () => {
  const site = makeSite("last-admin");
  const id = seedAccount(site, { email: "terakhir@example.test", role: "admin", verified: true });
  const result = cli(site, "tests/fixtures/q02/demote.php", ["999999", String(id)]);
  assert.match(result.stdout, /last_admin/);
  assert.equal(rows(site, "SELECT role FROM users WHERE id = ?", [id])[0].role, "admin");
});

test("two concurrent demotions cannot leave zero verified administrators", async () => {
  const site = makeSite("race-demote");
  const xId = seedAccount(site, { email: "x@example.test", role: "admin", verified: true });
  const yId = seedAccount(site, { email: "y@example.test", role: "admin", verified: true });
  const results = await concurrent(site, [
    ["tests/fixtures/q02/demote.php", String(xId), String(yId)],
    ["tests/fixtures/q02/demote.php", String(yId), String(xId)],
  ].map((args) => [...args.slice(0, 1).map((script) => join(repo, script)), ...args.slice(1)]));
  const successes = results.filter((result) => result.out.includes('"ok":true'));
  const refusals = results.filter((result) => result.out.includes("last_admin") || result.out.includes("self_demotion"));
  assert.equal(successes.length, 1, JSON.stringify(results));
  assert.equal(refusals.length, 1, JSON.stringify(results));
  const remaining = rows(site, "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND email_verified_at IS NOT NULL")[0].n;
  assert.equal(Number(remaining), 1, "exactly one verified administrator remains");
});

test("concurrent verification submissions consume the token exactly once", async () => {
  const site = makeSite("race-token");
  await withSite(site, async (api) => {
    const token = await registerAndGetToken(api, "serentak@example.test");
    const results = await concurrent(site, [
      [join(fixtures, "consume-token.php"), token],
      [join(fixtures, "consume-token.php"), token],
    ].map((args) => args));
    const consumed = results.filter((result) => result.out.startsWith("consumed:"));
    assert.equal(consumed.length, 1, JSON.stringify(results));
    assert.equal(results.filter((result) => result.out === "rejected").length, 1);
  });
});

/* ------------------------------------------------------------------ audit */

test("the security audit is administrator-only and records privilege changes without secrets", async () => {
  const site = makeSite("audit");
  seedAccount(site, { email: "auditor@example.test", role: "admin", verified: true });
  const targetId = seedAccount(site, { email: "target-audit@example.test", role: "admin", verified: true });
  await withSite(site, async (api) => {
    const admin = new Api(api.port);
    const learner = new Api(api.port);
    assert.equal((await login(admin, "auditor@example.test", PASSWORD)).status, 200);
    assert.equal((await admin.mutate("PUT", `/api/admin/users/${targetId}`, { role: "learner" })).status, 200);
    assert.equal((await login(learner, "target-audit@example.test", PASSWORD)).status, 200);

    assert.equal((await learner.get("/api/admin/security-audit")).status, 403, "learners cannot read the audit");
    const audit = await admin.get("/api/admin/security-audit?limit=50");
    assert.equal(audit.status, 200);
    const events = audit.json.data;
    const demotion = events.find((event) => event.eventType === "admin.role_changed");
    assert.ok(demotion, "role change is audited");
    assert.equal(demotion.targetUserId, targetId);
    assert.ok(events.some((event) => event.eventType === "auth.login_success"));
    const serialized = JSON.stringify(events);
    for (const secret of [PASSWORD, "password_hash", "token_hash", "devVerificationToken", "devResetToken", "aapm_layer_session"]) {
      assert.ok(!serialized.includes(secret), `audit must not contain ${secret}`);
    }
  });
});

test("a failed verification email leaves the account pending and retryable", async () => {
  const site = makeSite("delivery-failure");
  await withSite(site, async (api) => {
    const token = await registerAndGetToken(api, "gagal-kirim@example.test");
    assert.ok(token, "mail_from is empty, so delivery fails and dev exposure carries the token");
    assert.equal((await login(new Api(api.port), "gagal-kirim@example.test", PASSWORD)).json.error.code, "email_verification_required");
    const failed = rows(site, "SELECT result FROM security_audit_events WHERE event_type = ?", ["auth.verification_sent"]);
    assert.ok(failed.some((row) => row.result === "delivery_failed"));
    const retry = await api.mutate("POST", "/api/auth/resend-verification", { email: "gagal-kirim@example.test", password: PASSWORD });
    assert.ok(retry.json.data.devVerificationToken, "a retry issues a fresh token");
  });
});

/* ------------------------------------------------------------- migration */

test("migration replay is idempotent and preserves existing accounts", async () => {
  const site = makeSite("migration");
  seedAccount(site, { email: "tetap@example.test", verified: true });
  rows(site, "SELECT 1 AS ok");
  const first = cli(site, "database/migrate.php", ["--apply", "--verify", "--expect-environment=local"]);
  const second = cli(site, "database/migrate.php", ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Auth schema: present/);
  const recorded = rows(site, "SELECT COUNT(*) AS n FROM schema_migrations WHERE migration_key = ?", ["20261010_auth_verification_security_v1"])[0].n;
  assert.equal(Number(recorded), 1, "the Q02 key is recorded exactly once");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM users")[0].n), 1, "no account was lost or duplicated");
});

test("a Google callback without a valid state never creates a session", async () => {
  const site = makeSite("google-state");
  await withSite(site, async (api) => {
    const reply = await api.raw("GET", "/api/auth/google/callback?code=nilai&state=palsu");
    assert.equal(reply.status, 302);
    assert.match(reply.location ?? "", /oauth=/);
    assert.equal((await api.get("/api/auth/me")).status, 401);
  });
});
