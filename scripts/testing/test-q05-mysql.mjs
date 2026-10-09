#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.AAPM_TEST_MYSQL_CONFIG) {
  console.error("AAPM_TEST_MYSQL_CONFIG must identify the private, task-owned loopback runtime. No SQLite fallback is allowed.");
  process.exit(2);
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1",
  "tests/q05-curriculum.test.mjs", "tests/q05-policy-admin.test.mjs", "tests/q05-course-lifecycle.test.mjs"], {
  cwd: repo, env: process.env, stdio: "inherit",
});
process.exit(result.status ?? 1);
