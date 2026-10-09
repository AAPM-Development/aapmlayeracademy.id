// Shared release logic for the build-time tools. The PHP twin lives in
// scripts/release/lib.php and must produce identical fingerprints and error
// codes; tests/q01-environment-artifact.test.mjs checks that both agree.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export const MANIFEST_SCHEMA = "aapm-release-manifest/1";
export const MANIFEST_FILE = "build-manifest.json";
export const CHANNELS = ["local", "test", "staging", "production"];

const byteOrder = (a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function loadContract(root) {
  return JSON.parse(readFileSync(join(root, "scripts", "release", "contract.json"), "utf8"));
}

/** Recursive, byte-ordered list of files below `sub` (posix-style relative paths). */
export function listFiles(root, sub = "") {
  const base = join(root, sub);
  if (!existsSync(base)) return [];
  const out = [];
  const walk = (dirAbs, rel) => {
    for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dirAbs, entry.name), childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  };
  walk(base, sub);
  return out.sort(byteOrder);
}

export function rawHash(path) {
  return sha256(readFileSync(path));
}

/** Content hash under the contract's hashing rule: LF-normalised for text, raw for binary. */
export function contentHash(path, contract) {
  const bytes = readFileSync(path);
  if (contract.hashing.binaryExtensions.includes(extname(path).toLowerCase())) return sha256(bytes);
  return sha256(Buffer.from(bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1"));
}

/** @returns {{fingerprint:string,fileCount:number}} */
export function sourceFingerprint(sourceRoot, contract) {
  const rule = contract.fingerprint;
  const paths = new Set();
  for (const root of rule.roots) {
    if (!existsSync(join(sourceRoot, root))) throw new Error(`source root missing: ${root}`);
    for (const file of listFiles(sourceRoot, root)) paths.add(file);
  }
  for (const file of rule.files) {
    if (!existsSync(join(sourceRoot, file))) throw new Error(`source file missing: ${file}`);
    paths.add(file);
  }
  const included = [...paths]
    .filter((file) => !rule.excludePrefixes.some((prefix) => file.startsWith(prefix)))
    .sort(byteOrder);
  const lines = included.map((file) => `${contentHash(join(sourceRoot, file), contract)}  ${file}\n`);
  return { fingerprint: sha256(Buffer.from(lines.join(""), "utf8")), fileCount: included.length };
}

/** Artifact identity over declared payload entries: [{path, sha256}] sorted by path. */
export function artifactId(entries) {
  const lines = [...entries]
    .sort((a, b) => byteOrder(a.path, b.path))
    .map((entry) => `${entry.sha256}  ${entry.path}\n`);
  return sha256(Buffer.from(lines.join(""), "utf8"));
}

export function distributionFiles(distRoot) {
  return listFiles(distRoot).filter((file) => file !== MANIFEST_FILE);
}

/** Reads the database migration key so the manifest records schema compatibility. */
export function migrationKey(sourceRoot) {
  const text = readFileSync(join(sourceRoot, "database", "migrate.php"), "utf8");
  const match = /const AAPM_SCHEMA_MIGRATION_KEY = '([^']+)';/.exec(text);
  if (!match) throw new Error("migration key not found in database/migrate.php");
  return match[1];
}

/** Removes runtime uploads from a payload directory; keeps only contract-allowed control files. */
export function removeRuntimeUploads(distRoot, contract) {
  const removed = [];
  for (const file of listFiles(distRoot, contract.artifact.uploadsDir)) {
    if (contract.artifact.uploadsAllowed.includes(file)) continue;
    removed.push(file);
    rmSync(join(distRoot, file), { force: true });
  }
  pruneEmptyDirectories(join(distRoot, contract.artifact.uploadsDir));
  return removed;
}

function pruneEmptyDirectories(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(dir, entry.name);
    pruneEmptyDirectories(child);
    if (readdirSync(child).length === 0) rmSync(child, { recursive: true, force: true });
  }
}

export function buildManifest({ sourceRoot, distRoot, contract, channel, sourceCommit, sourceDirty, builtAt }) {
  const source = sourceFingerprint(sourceRoot, contract);
  const files = distributionFiles(distRoot).map((path) => ({
    path,
    sha256: contentHash(join(distRoot, path), contract),
    bytes: statSync(join(distRoot, path)).size,
  }));
  return {
    schema: MANIFEST_SCHEMA,
    channel,
    sourceCommit,
    sourceDirty,
    sourceTreeFingerprint: source.fingerprint,
    sourceFileCount: source.fileCount,
    artifactId: artifactId(files),
    builtAt,
    schemaCompatibility: {
      migrationKey: migrationKey(sourceRoot),
      environmentMarkerTable: "aapm_environment_marker",
    },
    files,
  };
}

/**
 * Verifies a distribution directory against its manifest and, when a source
 * root is supplied, against the checked source. Returns error objects with
 * stable codes; an empty list means the artifact is valid.
 */
export function verifyArtifact({ distRoot, sourceRoot, contract, expectedChannel = null }) {
  const errors = [];
  const fail = (code, path, detail) => errors.push({ code, path, detail });

  const manifestPath = join(distRoot, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    fail("manifest_missing", MANIFEST_FILE, "build manifest not found");
    return { ok: false, errors, summary: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("manifest_invalid", MANIFEST_FILE, "manifest is not valid JSON");
    return { ok: false, errors, summary: null };
  }

  if (manifest.schema !== MANIFEST_SCHEMA) fail("manifest_schema", MANIFEST_FILE, `expected ${MANIFEST_SCHEMA}`);
  if (!CHANNELS.includes(manifest.channel)) fail("channel_invalid", MANIFEST_FILE, "unknown build channel");
  if (expectedChannel !== null && manifest.channel !== expectedChannel) {
    fail("channel_mismatch", MANIFEST_FILE, `artifact is ${manifest.channel}, expected ${expectedChannel}`);
  }

  const declared = new Map((manifest.files ?? []).map((entry) => [entry.path, entry]));
  const actual = distributionFiles(distRoot);

  for (const path of actual) {
    if (!declared.has(path)) fail("undeclared_file", path, "file is not listed in the manifest");
  }
  for (const [path, meta] of declared) {
    const abs = join(distRoot, path);
    if (!existsSync(abs)) fail("missing_file", path, "listed in manifest but absent");
    else if (contentHash(abs, contract) !== meta.sha256) fail("hash_mismatch", path, "content differs from manifest");
  }

  for (const path of actual) {
    if (path.startsWith(`${contract.artifact.uploadsDir}/`) && !contract.artifact.uploadsAllowed.includes(path)) {
      fail("runtime_uploads_present", path, "runtime uploads must not be part of the payload");
    }
  }
  for (const path of contract.artifact.forbiddenFiles) {
    if (existsSync(join(distRoot, path))) fail("forbidden_file", path, "environment-specific server file in artifact");
  }
  for (const path of contract.artifact.requiredFiles) {
    if (!existsSync(join(distRoot, path))) fail("required_missing", path, "required file absent");
  }
  for (const dir of contract.artifact.requiredDirs) {
    if (!existsSync(join(distRoot, dir)) || !statSync(join(distRoot, dir)).isDirectory()) {
      fail("required_missing", dir, "required directory absent");
    }
  }
  if (existsSync(join(distRoot, "index.html"))) {
    const html = readFileSync(join(distRoot, "index.html"), "utf8");
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
      const ref = match[1].slice(1);
      if (!existsSync(join(distRoot, ref))) fail("asset_reference_missing", ref, "index.html references a missing asset");
    }
  }

  if (sourceRoot) {
    const srcPrefix = `${contract.artifact.apiSourceDir}/`;
    const distPrefix = `${contract.artifact.apiDistDir}/`;
    const sourceApi = listFiles(sourceRoot, contract.artifact.apiSourceDir).map((p) => p.slice(srcPrefix.length));
    const distApi = listFiles(distRoot, contract.artifact.apiDistDir).map((p) => p.slice(distPrefix.length));
    const sourceSet = new Set(sourceApi);
    const distSet = new Set(distApi);
    for (const name of sourceSet) {
      if (!distSet.has(name)) fail("api_file_missing", distPrefix + name, "present in source API, absent from distribution");
    }
    for (const name of distSet) {
      if (!sourceSet.has(name)) fail("api_file_extra", distPrefix + name, "present in distribution API, absent from source");
    }
    for (const name of sourceSet) {
      if (!distSet.has(name)) continue;
      if (contentHash(join(sourceRoot, srcPrefix + name), contract) !== contentHash(join(distRoot, distPrefix + name), contract)) {
        fail("api_content_mismatch", distPrefix + name, "distributed API differs from source API");
      }
    }

    try {
      const { fingerprint } = sourceFingerprint(sourceRoot, contract);
      if (fingerprint !== manifest.sourceTreeFingerprint) {
        fail("stale_artifact", MANIFEST_FILE, "source changed since this artifact was built");
      }
    } catch (error) {
      fail("source_unreadable", null, error.message);
    }
  }

  const recomputed = artifactId((manifest.files ?? []).map((entry) => ({ path: entry.path, sha256: entry.sha256 })));
  if (recomputed !== manifest.artifactId) fail("artifact_id_mismatch", MANIFEST_FILE, "artifact identity does not match its files");

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      channel: manifest.channel ?? null,
      artifactId: manifest.artifactId ?? null,
      sourceTreeFingerprint: manifest.sourceTreeFingerprint ?? null,
      fileCount: declared.size,
    },
  };
}
