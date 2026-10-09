#!/usr/bin/env node
// Writes dist/build-manifest.json for a built payload and removes runtime
// uploads so user media can never ride along in a deployment artifact.
//
//   node scripts/write-build-manifest.mjs --channel=staging [--dist=dist] [--source=.]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildManifest,
  CHANNELS,
  loadContract,
  MANIFEST_FILE,
  removeRuntimeUploads,
} from "./release/artifact-lib.mjs";

export function writeBuildManifest({ sourceRoot, distRoot, channel }) {
  if (!CHANNELS.includes(channel)) {
    throw new Error(`channel must be one of: ${CHANNELS.join(", ")}`);
  }
  const contract = loadContract(sourceRoot);
  const removedUploads = removeRuntimeUploads(distRoot, contract);
  const git = gitState(sourceRoot, contract);
  const manifest = buildManifest({
    sourceRoot,
    distRoot,
    contract,
    channel,
    sourceCommit: git.sourceCommit,
    sourceDirty: git.sourceDirty,
    builtAt: new Date().toISOString(),
  });
  writeFileSync(join(distRoot, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, removedUploads };
}

function gitState(sourceRoot, contract) {
  try {
    const run = (args) =>
      execFileSync("git", args, { cwd: sourceRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const sourceCommit = run(["rev-parse", "HEAD"]).trim();
    const inputs = [...contract.fingerprint.roots, ...contract.fingerprint.files];
    const dirty = run(["status", "--porcelain", "--", ...inputs]).trim() !== "";
    return { sourceCommit, sourceDirty: dirty };
  } catch {
    return { sourceCommit: "unknown", sourceDirty: null };
  }
}

function parseArgs(argv) {
  const options = { dist: "dist", source: ".", channel: null };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key in options) options[key] = value;
    else throw new Error(`unknown option: --${key}`);
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolve(options.source);
  const { manifest, removedUploads } = writeBuildManifest({
    sourceRoot,
    distRoot: resolve(sourceRoot, options.dist),
    channel: options.channel,
  });
  console.log(`manifest written: channel=${manifest.channel} artifact=${manifest.artifactId}`);
  console.log(`source fingerprint: ${manifest.sourceTreeFingerprint} (${manifest.sourceFileCount} files)`);
  if (removedUploads.length) console.log(`removed ${removedUploads.length} runtime upload file(s) from payload`);
}
