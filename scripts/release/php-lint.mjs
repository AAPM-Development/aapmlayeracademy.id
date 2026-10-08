#!/usr/bin/env node
// Runs `php -l` over every PHP file in the release-relevant trees.
//   node scripts/release/php-lint.mjs [--php=php]
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles } from "./artifact-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const phpArg = process.argv.find((arg) => arg.startsWith("--php="));
const php = phpArg ? phpArg.slice("--php=".length) : "php";
const extraArgs = (process.env.AAPM_PHP_ARGS ?? "").split(" ").filter(Boolean);

const trees = ["public/api", "database", "scripts", "tests"];
const rootFiles = ["config.native.example.php", "config.staging.example.php", "config.production.example.php"];
const files = [...trees.flatMap((tree) => listFiles(root, tree)), ...rootFiles].filter((file) => file.endsWith(".php"));

let failures = 0;
for (const file of files) {
  const result = spawnSync(php, [...extraArgs, "-l", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    failures += 1;
    console.error(`${file}: ${(result.stdout + result.stderr).trim()}`);
  }
}

console.log(`php -l: ${files.length - failures}/${files.length} file(s) pass`);
process.exit(failures === 0 ? 0 : 1);
