#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.AAPM_TEST_MYSQL_CONFIG) {
  console.error("AAPM_TEST_MYSQL_CONFIG must identify the private, task-owned loopback runtime. No SQLite fallback is allowed.");
  process.exit(2);
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.argv.slice(2);
if (mode.length > 1 || mode.some(value => value !== "--q03-q04")) {
  console.error("Only --q03-q04 is supported as a bounded native-regression option.");
  process.exit(2);
}
const suites = mode.length
  ? ["--test-name-pattern=A06|A17|concurrent module answers|C20/C49|C22", "tests/q03-assessment.test.mjs", "tests/q04-certification.test.mjs"]
  : ["tests/q05-curriculum.test.mjs", "tests/q05-policy-admin.test.mjs", "tests/q05-course-lifecycle.test.mjs"];
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...suites], {
  cwd: repo, env: process.env, stdio: "inherit",
});
process.exit(result.status ?? 1);
