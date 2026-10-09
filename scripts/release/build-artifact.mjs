#!/usr/bin/env node
// Builds a deployment artifact from the controlled source tree:
//   vite build -> strip runtime uploads -> write manifest -> verify.
// A failed verification leaves the output directory marked by a non-zero exit.
//
//   node scripts/release/build-artifact.mjs --channel=staging [--out=dist] [--source=<repo root>]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNELS, loadContract, verifyArtifact } from "./artifact-lib.mjs";
import { writeBuildManifest } from "../write-build-manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSource = resolve(scriptDir, "..", "..");

function parseArgs(argv) {
  const options = { channel: null, out: "dist", source: defaultSource };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (!(key in options)) throw new Error(`unknown option: --${key}`);
    options[key] = value;
  }
  return options;
}

export function buildArtifact({ sourceRoot, outDir, channel }) {
  if (!CHANNELS.includes(channel)) {
    throw new Error(`--channel is required and must be one of: ${CHANNELS.join(", ")}`);
  }
  const vite = join(sourceRoot, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(vite)) throw new Error("vite is not installed; run npm ci in this checkout first");

  const built = spawnSync(process.execPath, [vite, "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: sourceRoot,
    stdio: "inherit",
  });
  if (built.status !== 0) throw new Error(`vite build failed with status ${built.status}`);

  writeBuildManifest({ sourceRoot, distRoot: outDir, channel });
  const result = verifyArtifact({
    distRoot: outDir,
    sourceRoot,
    contract: loadContract(sourceRoot),
    expectedChannel: channel,
  });
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolve(options.source);
  try {
    const result = buildArtifact({
      sourceRoot,
      outDir: resolve(sourceRoot, options.out),
      channel: options.channel,
    });
    if (!result.ok) {
      for (const error of result.errors) console.error(`[${error.code}] ${error.path ?? ""}: ${error.detail}`);
      console.error("build rejected by verification");
      process.exit(1);
    }
    console.log(`artifact ready: channel=${result.summary.channel} artifact=${result.summary.artifactId}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
