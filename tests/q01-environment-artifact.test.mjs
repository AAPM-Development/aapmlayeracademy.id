// Q01 regression suite: environment isolation, artifact integrity, safe deploy.
// Runtime checks run the real API under `php -S` against disposable fixtures.
// Nothing here touches a real staging or production database, host, or upload.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import http from "node:http";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contentHash, loadContract, sourceFingerprint, verifyArtifact } from "../scripts/release/artifact-lib.mjs";
import { writeBuildManifest } from "../scripts/write-build-manifest.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "tests", "fixtures", "q01");
const contract = loadContract(repo);
const SQLITE_ARGS = ["-d", "extension=php_pdo_sqlite.dll", "-d", "extension=php_sqlite3.dll"];
const created = [];

after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

function scratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `aapm-q01-${name}-`));
  created.push(dir);
  return dir;
}

/** Environment without inherited AAPLAYERACADEMY_* or AAPM_* values, so tests control configuration. */
function cleanEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("AAPLAYERACADEMY_") && !key.startsWith("AAPM_")) env[key] = value;
  }
  return { ...env, ...extra };
}

function php(args, env = {}) {
  return spawnSync("php", [...SQLITE_ARGS, ...args], { encoding: "utf8", env: cleanEnv(env) });
}

function phpNode(args) {
  return spawnSync(process.execPath, args, { cwd: repo, encoding: "utf8", env: cleanEnv() });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Relative-path → sha256 for every file below dir. Used to prove a tree was not changed. */
function snapshot(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else out[relative(dir, absolute).split("\\").join("/")] = sha256File(absolute);
    }
  };
  walk(dir);
  return out;
}

const forwardSlashes = (path) => path.replace(/\\/g, "/");

function phpLiteral(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function writePrivateConfig(file, values) {
  mkdirSync(dirname(file), { recursive: true });
  const body = Object.entries(values)
    .map(([key, value]) => `    '${key}' => ${phpLiteral(value)},`)
    .join("\n");
  writeFileSync(file, `<?php\nreturn [\n${body}\n];\n`);
  return file;
}

const stagingValues = (overrides = {}) => ({
  environment: "staging",
  db_driver: "mysql",
  db_host: "127.0.0.1",
  db_port: "1",
  db_name: "aapm_staging",
  db_user: "aapm_staging_user",
  db_password: "SECRET-PASSWORD-123",
  app_url: "https://staging.aapmlayeracademy.id",
  session_name: "aapm_layer_session_staging",
  expose_dev_reset_token: false,
  ...overrides,
});

const testValues = (dbPath, overrides = {}) => ({
  environment: "test",
  db_driver: "sqlite",
  db_path: forwardSlashes(dbPath),
  app_url: "http://127.0.0.1",
  environment_marker_required: false,
  expose_dev_reset_token: false,
  ...overrides,
});

/** Writes the per-target selector that cpanel-deploy.php normally generates. */
function writeSelector(docroot, environment, configPath) {
  mkdirSync(join(docroot, "api"), { recursive: true });
  writeFileSync(
    join(docroot, "api", "deployment.php"),
    "<?php\nif (!defined('AAPM_DEPLOYMENT_SELECTOR_LOADING')) {\n    http_response_code(404);\n    exit;\n}\n" +
      `return [\n    'environment' => '${environment}',\n    'config_path' => '${forwardSlashes(configPath)}',\n];\n`
  );
}

function copySourceInputs(target) {
  for (const root of contract.fingerprint.roots) {
    cpSync(join(repo, root), join(target, root), {
      recursive: true,
      filter: (path) => !path.startsWith(join(repo, "public", "uploads")),
    });
  }
  for (const file of [...contract.fingerprint.files, "scripts/release/contract.json"]) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    cpSync(join(repo, file), join(target, file));
  }
  return target;
}

/** A source copy plus a distribution built from the committed payload, with a manifest for that source. */
function makeArtifact(root, channel) {
  const source = copySourceInputs(join(root, "source"));
  const dist = join(root, "dist");
  cpSync(join(repo, "dist"), dist, { recursive: true });
  writeBuildManifest({ sourceRoot: source, distRoot: dist, channel });
  return { source, dist };
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

function getJson(port, path, host) {
  return new Promise((resolveRequest, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, path, method: "GET", headers: host ? { Host: host } : {} },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = null;
          }
          resolveRequest({ status: response.statusCode, text: body, json });
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

async function startSite(docroot, env = {}) {
  const port = await freePort();
  let stderr = "";
  const child = spawn("php", [...SQLITE_ARGS, "-S", `127.0.0.1:${port}`, "-t", docroot, join(docroot, "router.php")], {
    env: cleanEnv(env),
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => (stderr += chunk));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`php server exited: ${stderr}`);
    try {
      await getJson(port, "/api/health");
      return { port, stop: () => child.kill() };
    } catch {
      await sleep(100);
    }
  }
  child.kill();
  throw new Error("php server did not start");
}

async function withSite(docroot, env, run) {
  const site = await startSite(docroot, env);
  try {
    return await run(site.port);
  } finally {
    site.stop();
  }
}

function makeSite(root, channel) {
  const docroot = join(root, "site", "public_html");
  const artifact = makeArtifact(root, channel);
  cpSync(artifact.dist, docroot, { recursive: true });
  return docroot;
}

const migrate = (args, configPath) =>
  php([join(repo, "database", "migrate.php"), ...args], { AAPLAYERACADEMY_CONFIG: configPath });

/* ------------------------------------------------------------------ runtime */

test("missing private configuration fails closed without revealing paths", async () => {
  const root = scratch("missing");
  const docroot = makeSite(root, "staging");
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.ok, false);
    assert.equal(health.json.error.code, "config_missing");
    assert.ok(!health.text.includes(root), "health must not reveal filesystem paths");

    const api = await getJson(port, "/api/auth/csrf");
    assert.equal(api.status, 503);
    assert.equal(api.json.error.code, "configuration_unavailable");
    assert.ok(!api.text.includes(root), "API errors must not reveal filesystem paths");
  });
});

test("a config without an explicit environment is rejected, never guessed", async () => {
  const root = scratch("no-environment");
  const docroot = makeSite(root, "test");
  const config = writePrivateConfig(join(root, "private", "config.php"), { db_driver: "sqlite", db_path: forwardSlashes(join(root, "private", "db.sqlite")) });
  writeFileSync(join(root, "private", "db.sqlite"), "");
  await withSite(docroot, { AAPLAYERACADEMY_CONFIG: config }, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "environment_invalid");
  });
});

test("deployed environments refuse SQLite even when explicitly configured", async () => {
  const root = scratch("deployed-sqlite");
  const docroot = makeSite(root, "staging");
  const config = writePrivateConfig(join(root, "private", "staging.php"), stagingValues({ db_driver: "sqlite", db_path: forwardSlashes(join(root, "private", "x.sqlite")) }));
  writeSelector(docroot, "staging", config);
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "sqlite_not_allowed");
  });
});

test("a private config inside the document root is refused", async () => {
  const root = scratch("inside-docroot");
  const docroot = makeSite(root, "test");
  const config = writePrivateConfig(join(docroot, "config.php"), testValues(join(root, "private", "db.sqlite")));
  await withSite(docroot, { AAPLAYERACADEMY_CONFIG: config }, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "config_inside_docroot");
  });
});

test("a local development file cannot declare a deployed environment", async () => {
  const root = scratch("local-candidate");
  const docroot = makeSite(root, "staging");
  // dirname(api, 2) of the docroot is root/site, where a stray config.php would be picked up.
  writePrivateConfig(join(root, "site", "config.php"), stagingValues());
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "local_config_not_allowed");
  });
});

test("the request Host header never selects the environment", async () => {
  const root = scratch("host-header");
  const docroot = makeSite(root, "test");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(join(root, "private", "db.sqlite")));
  writeSelector(docroot, "test", config);
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health", "aapmlayeracademy.id");
    assert.equal(health.status, 200);
    assert.equal(health.json.environment, "test");
    const staged = await getJson(port, "/api/health", "staging.aapmlayeracademy.id");
    assert.equal(staged.json.environment, "test");
  });
});

test("a conflicting AAPLAYERACADEMY_ENV variable is refused", async () => {
  const root = scratch("env-conflict");
  const docroot = makeSite(root, "test");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(join(root, "private", "db.sqlite")));
  writeSelector(docroot, "test", config);
  await withSite(docroot, { AAPLAYERACADEMY_ENV: "staging" }, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "environment_conflict");
  });
});

test("placeholder values in a deployed config are refused", async () => {
  const root = scratch("placeholder");
  const docroot = makeSite(root, "staging");
  const config = writePrivateConfig(join(root, "private", "staging.php"), stagingValues({ db_password: "REPLACE_WITH_STAGING_DB_PASSWORD" }));
  writeSelector(docroot, "staging", config);
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "placeholder_value");
  });
});

test("a deployed site refuses an artifact built for another channel", async () => {
  const root = scratch("channel-mismatch");
  const docroot = makeSite(root, "production");
  const config = writePrivateConfig(join(root, "private", "staging.php"), stagingValues());
  writeSelector(docroot, "staging", config);
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "build_identity_mismatch");
  });
});

test("an unreachable database reports a safe code without connection details", async () => {
  const root = scratch("db-down");
  const docroot = makeSite(root, "staging");
  const config = writePrivateConfig(join(root, "private", "staging.php"), stagingValues());
  writeSelector(docroot, "staging", config);
  await withSite(docroot, {}, async (port) => {
    const health = await getJson(port, "/api/health");
    assert.equal(health.status, 503);
    assert.equal(health.json.error.code, "database_unavailable");
    assert.ok(!health.text.includes("127.0.0.1"), "host must not appear in the response");
    assert.ok(!health.text.includes("SECRET-PASSWORD-123"), "password must never appear in the response");
    assert.ok(!health.text.includes("aapm_staging"), "database name must not appear in the response");
  });
});

test("environment marker: missing, provisioned, verified, then mismatch is refused", async () => {
  const root = scratch("marker-lifecycle");
  const docroot = makeSite(root, "test");
  const dbPath = join(root, "private", "aapm-test.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(dbPath, { environment_marker_required: true }));
  writeSelector(docroot, "test", config);

  await withSite(docroot, {}, async (port) => {
    const before = await getJson(port, "/api/health");
    assert.equal(before.status, 503);
    assert.equal(before.json.error.code, "environment_marker_missing");
  });

  const init = migrate(["--init-environment-marker", "--expect-environment=test"], config);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.match(init.stdout, /Environment marker: created/);

  await withSite(docroot, {}, async (port) => {
    const verified = await getJson(port, "/api/health");
    assert.equal(verified.status, 200);
    assert.equal(verified.json.ok, true);
    assert.equal(verified.json.environmentMarker.status, "verified");
    assert.equal(verified.json.build.channel, "test");
  });

  const apply = migrate(["--apply", "--verify", "--expect-environment=test"], config);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);

  await withSite(docroot, {}, async (port) => {
    const recorded = await getJson(port, "/api/health");
    assert.equal(recorded.json.schema.status, "recorded");
    assert.equal(recorded.json.schema.latestMigration, "20261015_assessment_authority_v1");
  });

  assert.equal(spawnSync("php", [...SQLITE_ARGS, join(fixtures, "set-marker.php"), dbPath, "production"], { encoding: "utf8" }).status, 0);
  await withSite(docroot, {}, async (port) => {
    const mismatch = await getJson(port, "/api/health");
    assert.equal(mismatch.status, 503);
    assert.equal(mismatch.json.error.code, "environment_marker_mismatch");
  });
  const refused = migrate(["--apply", "--expect-environment=test"], config);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /Penanda lingkungan database belum valid \(mismatch\)/);
});

/* ---------------------------------------------------------- migration guard */

test("migration refuses mutating modes without an expected environment, before connecting", async () => {
  const root = scratch("migrate-expect");
  const dbPath = join(root, "private", "db.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(dbPath));
  const before = sha256File(dbPath);

  const apply = migrate(["--apply"], config);
  assert.equal(apply.status, 2);
  assert.match(apply.stderr, /--expect-environment=<lingkungan> wajib/);
  const init = migrate(["--init-environment-marker"], config);
  assert.equal(init.status, 2);
  assert.equal(sha256File(dbPath), before, "database file must not change");
});

test("migration refuses a target that does not match the configuration", async () => {
  const root = scratch("migrate-target");
  const dbPath = join(root, "private", "db.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(dbPath));
  const before = sha256File(dbPath);

  const wrong = migrate(["--apply", "--expect-environment=staging"], config);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /Target tidak cocok/);
  assert.equal(sha256File(dbPath), before);
});

test("plan mode never mutates the database", async () => {
  const root = scratch("migrate-plan");
  const dbPath = join(root, "private", "db.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(dbPath));
  const before = sha256File(dbPath);
  migrate(["--plan"], config);
  migrate(["--verify"], config);
  assert.equal(sha256File(dbPath), before);
});

test("init never overwrites a marker that names another environment", async () => {
  const root = scratch("marker-overwrite");
  const dbPath = join(root, "private", "db.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, "");
  const config = writePrivateConfig(join(root, "private", "test.php"), testValues(dbPath));
  assert.equal(spawnSync("php", [...SQLITE_ARGS, join(fixtures, "set-marker.php"), dbPath, "production"], { encoding: "utf8" }).status, 0);

  const result = migrate(["--init-environment-marker", "--expect-environment=test"], config);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Penanda tidak diubah/);
  const check = spawnSync("php", [...SQLITE_ARGS, join(fixtures, "set-marker.php"), dbPath, "production"], { encoding: "utf8" });
  assert.match(check.stdout, /marker=production/);
});

/* ----------------------------------------------------------------- artifact */

/**
 * On this memory-constrained Windows host, Vite's native and zlib work has
 * failed with "VirtualAlloc ... out of memory", "The service was stopped",
 * "insufficient memory", or an access violation, while the same build passes
 * when rerun. A failed Vite step is retried up to three attempts and every
 * retry is printed. Verification failures ("build rejected by verification")
 * are never retried, so a real artifact problem still fails at once.
 */
function buildFreshArtifact(out) {
  let attempt = null;
  for (let tries = 1; tries <= 3; tries++) {
    attempt = phpNode(["scripts/release/build-artifact.mjs", "--channel=staging", `--out=${out}`, `--source=${repo}`]);
    if (attempt.status === 0) {
      if (tries > 1) console.log(`fresh build succeeded on attempt ${tries} after Vite infrastructure failures`);
      return attempt;
    }
    if (!/vite build failed/.test(attempt.stdout + attempt.stderr)) break;
  }
  return attempt;
}

test("a fresh build verifies with both Node and PHP, and both report the same identity", async () => {
  const root = scratch("fresh-build");
  const out = join(root, "dist");
  const built = buildFreshArtifact(out);
  assert.equal(built.status, 0, built.stdout + built.stderr);

  const node = await verifyArtifact({ distRoot: out, sourceRoot: repo, contract, expectedChannel: "staging" });
  assert.equal(node.ok, true, JSON.stringify(node.errors));

  const phpVerdict = php([join(repo, "scripts", "release", "validate-artifact.php"), `--source=${repo}`, `--dist=${out}`, "--channel=staging", "--json"]);
  assert.equal(phpVerdict.status, 0, phpVerdict.stdout);
  assert.equal(JSON.parse(phpVerdict.stdout).summary.artifactId, node.summary.artifactId);
  assert.equal(readdirSync(join(out, "uploads")).join(","), ".htaccess", "only the control file may ship in uploads/");
}, { timeout: 240000 });

test("a CRLF working copy and an LF checkout produce the same content hash in both implementations", async () => {
  const root = scratch("line-endings");
  const lf = join(root, "lf.js");
  const crlf = join(root, "crlf.js");
  writeFileSync(lf, "export const a = 1;\nexport const b = 2;\n");
  writeFileSync(crlf, "export const a = 1;\r\nexport const b = 2;\r\n");
  assert.equal(contentHash(lf, contract), contentHash(crlf, contract));

  const script = `require ${JSON.stringify(join(repo, "scripts", "release", "lib.php"))}; $c = aapm_release_contract(${JSON.stringify(repo)}); echo aapm_release_content_hash($argv[1], $c), " ", aapm_release_content_hash($argv[2], $c);`;
  const result = php(["-r", script, lf, crlf]);
  assert.equal(result.status, 0, result.stderr);
  const [phpLf, phpCrlf] = result.stdout.trim().split(" ");
  assert.equal(phpLf, phpCrlf);
  assert.equal(phpLf, contentHash(lf, contract));

  const binary = join(root, "image.png");
  writeFileSync(binary, Buffer.from([0x89, 0x50, 0x0d, 0x0a]));
  // Binary extensions keep their raw bytes: CR bytes inside an image are content, not line endings.
  assert.equal(contentHash(binary, contract), createHash("sha256").update(Buffer.from([0x89, 0x50, 0x0d, 0x0a])).digest("hex"));
});

test("Node and PHP fingerprints agree on the repository source", async () => {
  const node = sourceFingerprint(repo, contract);
  const phpResult = php([join(fixtures, "fingerprint.php"), repo]);
  assert.equal(phpResult.status, 0, phpResult.stderr);
  const [fingerprint, count] = phpResult.stdout.trim().split(" ");
  assert.equal(fingerprint, node.fingerprint);
  assert.equal(Number(count), node.fileCount);
});

test("a stale artifact is rejected by both verifiers after the source changes", async () => {
  const root = scratch("stale-source");
  const artifact = makeArtifact(root, "staging");
  assert.equal((await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" })).ok, true);

  writeFileSync(join(artifact.source, "src", "lib", "q01-drift.js"), "export const drift = true;\n");
  const node = await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" });
  assert.ok(node.errors.some((error) => error.code === "stale_artifact"), JSON.stringify(node.errors));

  const phpVerdict = php([join(repo, "scripts", "release", "validate-artifact.php"), `--source=${artifact.source}`, `--dist=${artifact.dist}`, "--json"]);
  assert.equal(phpVerdict.status, 1);
  assert.ok(JSON.parse(phpVerdict.stdout).errors.some((error) => error.code === "stale_artifact"));
});

test("an intentionally stale distribution is rejected for API drift", async () => {
  const root = scratch("stale-dist");
  const artifact = makeArtifact(root, "staging");
  writeFileSync(join(artifact.dist, "api", "bootstrap.php"), "<?php\n// older API build\n");
  const node = await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" });
  const codes = node.errors.map((error) => error.code);
  assert.ok(codes.includes("hash_mismatch"), codes.join(","));
  assert.ok(codes.includes("api_content_mismatch"), codes.join(","));

  const phpVerdict = php([join(repo, "scripts", "release", "validate-artifact.php"), `--source=${artifact.source}`, `--dist=${artifact.dist}`, "--json"]);
  assert.equal(phpVerdict.status, 1);
  assert.ok(JSON.parse(phpVerdict.stdout).errors.some((error) => error.code === "api_content_mismatch"));
});

test("runtime uploads never enter the payload, and the build strips them", async () => {
  const root = scratch("uploads-payload");
  const artifact = makeArtifact(root, "staging");
  const stray = join(artifact.dist, "uploads", "editorial", "images", "2026", "09", "learner.png");
  mkdirSync(dirname(stray), { recursive: true });
  writeFileSync(stray, "not-a-real-image");

  const before = await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" });
  const beforeCodes = before.errors.map((error) => error.code);
  assert.ok(beforeCodes.includes("runtime_uploads_present"), beforeCodes.join(","));

  const rebuilt = writeBuildManifest({ sourceRoot: artifact.source, distRoot: artifact.dist, channel: "staging" });
  assert.ok(rebuilt.removedUploads.includes("uploads/editorial/images/2026/09/learner.png"));
  assert.equal(existsSync(stray), false, "stray upload must be removed from the payload");
  assert.equal((await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" })).ok, true);
});

test("a missing required asset and a forbidden deployment selector are rejected", async () => {
  const root = scratch("required");
  const artifact = makeArtifact(root, "staging");
  rmSync(join(artifact.dist, "sw.js"));
  writeFileSync(join(artifact.dist, "api", "deployment.php"), "<?php return [];\n");
  const verdict = await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "staging" });
  const codes = verdict.errors.map((error) => error.code);
  assert.ok(codes.includes("required_missing"), codes.join(","));
  assert.ok(codes.includes("missing_file"), codes.join(","));
  assert.ok(codes.includes("forbidden_file"), codes.join(","));
  assert.ok(codes.includes("api_file_extra"), codes.join(","));
});

test("a channel mismatch is rejected", async () => {
  const root = scratch("channel");
  const artifact = makeArtifact(root, "staging");
  const verdict = await verifyArtifact({ distRoot: artifact.dist, sourceRoot: artifact.source, contract, expectedChannel: "production" });
  assert.ok(verdict.errors.some((error) => error.code === "channel_mismatch"));
});

/* ------------------------------------------------------------------- deploy */

function stagingDeploy(root, artifact, target, extra = {}) {
  const privateConfig = writePrivateConfig(join(root, "private", "staging-config.php"), stagingValues({ db_password: "not-a-real-secret" }));
  return php([
    join(repo, "scripts", "deploy", "cpanel-deploy.php"),
    "--channel=staging",
    `--target=${target}`,
    `--private-config=${privateConfig}`,
    `--source=${artifact.source}`,
    `--dist=${extra.dist ?? artifact.dist}`,
    `--state=${join(root, "state")}`,
  ]);
}

function seedLiveUploads(target) {
  const live = join(target, "uploads", "editorial", "images", "2026", "09", "live-learner.png");
  mkdirSync(dirname(live), { recursive: true });
  writeFileSync(live, "live-learner-bytes");
  writeFileSync(join(target, "uploads", ".htaccess"), "Options -Indexes\n# site-specific rules\n");
}

test("a deploy installs the verified artifact and preserves live uploads", async () => {
  const root = scratch("deploy-install");
  const artifact = makeArtifact(root, "staging");
  const target = join(root, "targets", "staging", "public_html");
  mkdirSync(target, { recursive: true });
  seedLiveUploads(target);
  const uploadsBefore = snapshot(join(target, "uploads"));

  const deployed = stagingDeploy(root, artifact, target);
  assert.equal(deployed.status, 0, deployed.stdout + deployed.stderr);
  assert.match(deployed.stdout, /deployed channel=staging/);

  assert.deepEqual(snapshot(join(target, "uploads")), uploadsBefore, "live uploads and the existing .htaccess must be untouched");
  const manifest = JSON.parse(readFileSync(join(target, "build-manifest.json"), "utf8"));
  for (const entry of manifest.files.filter((file) => !file.path.startsWith("uploads/"))) {
    assert.equal(contentHash(join(target, entry.path), contract), entry.sha256, entry.path);
  }
  const selector = readFileSync(join(target, "api", "deployment.php"), "utf8");
  assert.match(selector, /'environment' => 'staging'/);
  assert.match(selector, /aapm_staging_config|staging-config\.php/);
  assert.ok(existsSync(join(root, "state", "staging", "last-deploy.json")));
}, { timeout: 120000 });

test("a rejected artifact leaves the target byte-for-byte unchanged", async () => {
  const root = scratch("deploy-reject");
  const artifact = makeArtifact(root, "staging");
  const target = join(root, "targets", "staging", "public_html");
  mkdirSync(target, { recursive: true });
  seedLiveUploads(target);
  writeFileSync(join(target, "index.html"), "<!doctype html><title>previous release</title>");
  const before = snapshot(target);

  writeFileSync(join(artifact.source, "src", "lib", "q01-drift.js"), "export const drift = 1;\n");
  const result = stagingDeploy(root, artifact, target);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /artifact rejected; nothing was copied/);
  assert.deepEqual(snapshot(target), before);
});

test("private configuration problems stop the deploy before anything is copied", async () => {
  const cases = {
    "config inside target": (root, target) => writePrivateConfig(join(target, "private.php"), stagingValues()),
    "wrong environment": (root) => writePrivateConfig(join(root, "private", "bad-env.php"), stagingValues({ environment: "production" })),
    "placeholder value": (root) => writePrivateConfig(join(root, "private", "placeholder.php"), stagingValues({ db_password: "REPLACE_ME" })),
    "sqlite driver": (root) => writePrivateConfig(join(root, "private", "sqlite.php"), stagingValues({ db_driver: "sqlite" })),
  };
  for (const [name, makeConfig] of Object.entries(cases)) {
    const root = scratch("deploy-config");
    const artifact = makeArtifact(root, "staging");
    const target = join(root, "targets", "staging", "public_html");
    mkdirSync(target, { recursive: true });
    seedLiveUploads(target);
    // Create the config first: it may itself live inside the target under test.
    const configPath = makeConfig(root, target);
    const before = snapshot(target);
    const result = php([
      join(repo, "scripts", "deploy", "cpanel-deploy.php"),
      "--channel=staging",
      `--target=${target}`,
      `--private-config=${configPath}`,
      `--source=${artifact.source}`,
      `--dist=${artifact.dist}`,
      `--state=${join(root, "state")}`,
    ]);
    assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`);
    assert.deepEqual(snapshot(target), before, `${name}: target must not change`);
  }
});

test("a staging deploy never touches a production target", async () => {
  const root = scratch("isolation");
  const artifact = makeArtifact(root, "staging");
  const staging = join(root, "targets", "staging", "public_html");
  const production = join(root, "targets", "production", "public_html");
  mkdirSync(staging, { recursive: true });
  mkdirSync(production, { recursive: true });
  seedLiveUploads(production);
  writeFileSync(join(production, "index.html"), "<!doctype html><title>production</title>");
  const productionBefore = snapshot(production);

  assert.equal(stagingDeploy(root, artifact, staging).status, 0);
  assert.deepEqual(snapshot(production), productionBefore, "production target must be byte-identical");
}, { timeout: 120000 });

test("rollback to a previous artifact restores it and keeps uploads", async () => {
  const root = scratch("rollback");
  const artifact = makeArtifact(root, "staging");
  const target = join(root, "targets", "staging", "public_html");
  mkdirSync(target, { recursive: true });
  seedLiveUploads(target);
  const uploadsBefore = snapshot(join(target, "uploads"));

  const releaseOne = JSON.parse(readFileSync(join(artifact.dist, "build-manifest.json"), "utf8"));
  assert.equal(stagingDeploy(root, artifact, target).status, 0);

  const releaseTwo = join(root, "dist-release-2");
  cpSync(artifact.dist, releaseTwo, { recursive: true });
  writeFileSync(join(releaseTwo, "index.html"), readFileSync(join(releaseTwo, "index.html"), "utf8") + "\n<!-- release 2 -->\n");
  writeBuildManifest({ sourceRoot: artifact.source, distRoot: releaseTwo, channel: "staging" });
  assert.equal(stagingDeploy(root, artifact, target, { dist: releaseTwo }).status, 0);
  assert.match(readFileSync(join(target, "index.html"), "utf8"), /release 2/);

  const rollback = stagingDeploy(root, artifact, target);
  assert.equal(rollback.status, 0, rollback.stdout + rollback.stderr);
  const restored = JSON.parse(readFileSync(join(target, "build-manifest.json"), "utf8"));
  assert.equal(restored.artifactId, releaseOne.artifactId);
  assert.doesNotMatch(readFileSync(join(target, "index.html"), "utf8"), /release 2/);
  assert.deepEqual(snapshot(join(target, "uploads")), uploadsBefore, "rollback must never touch uploads");
}, { timeout: 180000 });

/* -------------------------------------------------------------- media + lint */

test("sample media import is additive and never overwrites a conflicting file", async () => {
  const root = scratch("media-import");
  const sample = join(root, "sample");
  const live = join(root, "live");
  mkdirSync(sample, { recursive: true });
  mkdirSync(live, { recursive: true });
  writeFileSync(join(sample, "a.png"), "AAA");
  writeFileSync(join(sample, "b.png"), "BBB");
  const run = (extra) => php([join(repo, "scripts", "release", "import-sample-media.php"), `--source=${sample}`, `--target=${live}`, ...extra]);

  writeFileSync(join(live, "a.png"), "DIFFERENT-LIVE-FILE");
  const conflict = run(["--apply"]);
  assert.equal(conflict.status, 1, conflict.stdout);
  assert.match(conflict.stdout, /conflict \(not overwritten\): a\.png/);
  assert.equal(existsSync(join(live, "b.png")), false, "nothing is copied while a conflict exists");
  assert.equal(readFileSync(join(live, "a.png"), "utf8"), "DIFFERENT-LIVE-FILE");

  writeFileSync(join(live, "a.png"), "AAA");
  const dry = run([]);
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /1 to copy, 1 already present/);
  assert.equal(existsSync(join(live, "b.png")), false, "dry run copies nothing");

  assert.equal(run(["--apply"]).status, 0);
  assert.equal(readFileSync(join(live, "b.png"), "utf8"), "BBB");
  assert.equal(readFileSync(join(live, "a.png"), "utf8"), "AAA");
});

test("every release-relevant PHP file passes php -l", async () => {
  const result = phpNode(["scripts/release/php-lint.mjs"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("the configuration and deploy wiring keep their Q01 guarantees", async () => {
  const bootstrap = readFileSync(join(repo, "public", "api", "bootstrap.php"), "utf8");
  assert.doesNotMatch(bootstrap, /aapmlayeracademy-config\.php/, "no account-level shared config may be loaded");
  assert.doesNotMatch(bootstrap, /'app_env' =>/, "app_env must not be a configuration source");
  assert.match(bootstrap, /aapm_resolve_config_source/);

  const migrate = readFileSync(join(repo, "database", "migrate.php"), "utf8");
  assert.doesNotMatch(migrate, /storage\/aapmlayeracademy\.sqlite/, "migration must not fall back to storage/");

  const cpanel = readFileSync(join(repo, ".cpanel.yml"), "utf8");
  assert.match(cpanel, /AAPM_RELEASE_CHANNEL=production/);
  assert.match(cpanel, /AAPM_RELEASE_CHANNEL=staging/);
  assert.match(cpanel, /scripts\/deploy\/cpanel-deploy\.php/);
  assert.doesNotMatch(cpanel, /cp -R dist/, "the deploy must never copy the whole dist blindly");
});
