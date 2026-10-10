#!/usr/bin/env node
// Verifies a distribution against its manifest, the checked source API, and
// the source-tree fingerprint. Exits 1 on any finding.
//
//   node scripts/verify-dist-parity.mjs [--dist=dist] [--source=.] [--channel=staging] [--json]
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContract, verifyArtifact } from "./release/artifact-lib.mjs";

export function runParityCheck({ sourceRoot, distRoot, expectedChannel = null }) {
  return verifyArtifact({
    distRoot,
    sourceRoot,
    contract: loadContract(sourceRoot),
    expectedChannel,
  });
}

function parseArgs(argv) {
  const options = { dist: "dist", source: ".", channel: null, json: false };
  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (!(key in options)) throw new Error(`unknown option: --${key}`);
    options[key] = value;
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolve(options.source);
  const result = runParityCheck({
    sourceRoot,
    distRoot: resolve(sourceRoot, options.dist),
    expectedChannel: options.channel,
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`artifact verified: channel=${result.summary.channel} artifact=${result.summary.artifactId}`);
  } else {
    for (const error of result.errors) console.error(`[${error.code}] ${error.path ?? ""}: ${error.detail}`);
    console.error(`artifact rejected (${result.errors.length} finding(s))`);
  }
  process.exit(result.ok ? 0 : 1);
}
