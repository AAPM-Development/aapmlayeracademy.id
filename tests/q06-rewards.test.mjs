import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getRankProgress, learnerRanks } from "../src/lib/academyData.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = spawnSync("php", [join(repo, "tests", "fixtures", "q06", "rewards.php")], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const server = JSON.parse(run.stdout);

test("points follow the documented weights and are capped", () => {
  // 3*100 + 2*35 + 1*150 + 92 + 9*10 + min(60, 13)
  assert.equal(server.points, 300 + 70 + 150 + 92 + 90 + 13);
  assert.equal(server.empty, 0);
});

test("hostile or negative inputs never go below zero or past the caps", () => {
  // quiz 100 + farm 12*10 + study 0
  assert.equal(server.hostile, 100 + 120);
});

test("level thresholds are inclusive and the top level has no next", () => {
  assert.deepEqual(server.levelAt, ["Foundation", "Foundation", "Field Builder", "Field Builder", "Farm Analyst", "Farm Analyst", "Layer Leader", "Layer Leader"]);
  assert.equal(server.top.nextAt, null);
  assert.equal(server.top.nextName, null);
});

test("ranks follow real curriculum progress, not a quarter of the available points", () => {
  assert.equal(server.earlyLearner, "Field Builder", "5 of 22 modules is not the top rank");
  assert.equal(server.supervisorTier, "Farm Analyst", "the supervisor tier reaches the analyst rank");
  assert.equal(server.advancedTier, "Layer Leader", "the advanced tier reaches the top rank");
});

test("the web ladder matches the server ladder exactly", () => {
  assert.deepEqual(learnerRanks, server.levels);
  for (const points of [0, 399, 400, 1499, 1500, 2699, 2700, 5000]) {
    assert.equal(getRankProgress(points).name, server.levelAt[[0, 399, 400, 1499, 1500, 2699, 2700, 5000].indexOf(points)]);
  }
});

test("web point rules list the server weights", () => {
  const profile = readFileSync(join(repo, "src", "pages", "Profile.jsx"), "utf8");
  const php = readFileSync(join(repo, "public", "api", "rewards.php"), "utf8");
  const weight = (name) => {
    const start = php.indexOf(`const ${name} = `);
    assert.ok(start >= 0, `${name} is defined`);
    return Number(php.slice(start + `const ${name} = `.length, php.indexOf(";", start)));
  };
  assert.ok(profile.includes(`reward: "+${weight("AAPM_POINTS_PER_MODULE")}"`));
  assert.ok(profile.includes(`reward: "+${weight("AAPM_POINTS_PER_PRACTICE")}"`));
  assert.ok(profile.includes(`reward: "+${weight("AAPM_POINTS_PER_CERTIFICATE")}"`));
  assert.ok(profile.includes(`reward: "maks +${weight("AAPM_FARM_ENTRIES_CAP") * weight("AAPM_POINTS_PER_FARM_ENTRY")}"`));
  assert.ok(profile.includes(`reward: "maks +${weight("AAPM_STUDY_POINTS_CAP")}"`));
  assert.ok(profile.includes(`reward: "maks +${weight("AAPM_POINTS_QUIZ_MAX")}"`));
});

test("achievements: unique ids, positive targets, stable level thresholds", () => {
  const ids = server.definitions.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "ids are stored once earned, so they must stay unique");
  for (const item of server.definitions) {
    assert.ok(item.target > 0, `${item.id} needs a positive target`);
    assert.ok(item.title && item.description, `${item.id} needs a title and description`);
  }
  const byId = Object.fromEntries(server.definitions.map((item) => [item.id, item]));
  assert.equal(byId["level-builder"].target, server.levels[1].from);
  assert.equal(byId["level-analyst"].target, server.levels[2].from);
  assert.equal(byId["level-leader"].target, server.levels[3].from);
  assert.equal(byId["modules-3"].current, 3);
});

test("an empty catalogue cannot make course achievements instantly unlocked or divide by zero", () => {
  assert.ok(server.zeroTotal["course-complete"] >= 1);
});
