// Curriculum reference rules shared by the calculators and the weekly KPI reading.
// The curriculum document fixes them: a value exactly on a boundary belongs to the next band.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FCR_ZONES, fcrZone, weeklyReading } from "../src/lib/kpiReading.js";

test("FCR bands follow the curriculum: a value on a boundary moves to the next band", () => {
  assert.deepEqual(FCR_ZONES.map((zone) => zone.label), ["Sangat baik", "Wajar", "Evaluasi"]);
  assert.equal(fcrZone(2.19).label, "Sangat baik");
  assert.equal(fcrZone(2.2).label, "Wajar");
  assert.equal(fcrZone(2.59).label, "Wajar");
  assert.equal(fcrZone(2.6).label, "Evaluasi");
  assert.equal(fcrZone(3.4).label, "Evaluasi");
});

test("the weekly reading raises FCR exactly where the calculator says Evaluasi", () => {
  const week = (fcr) => [
    { week: 30, fcr: 2.4 },
    { week: 31, fcr },
  ];
  const onBoundary = weeklyReading(week(2.6));
  assert.ok(onBoundary.findings.some((finding) => finding.metric === "fcr" && finding.tone === "negative" && /evaluasi/i.test(finding.text)), JSON.stringify(onBoundary.findings));
  const below = weeklyReading(week(2.59));
  assert.ok(!below.findings.some((finding) => finding.metric === "fcr" && /evaluasi/i.test(finding.text)), JSON.stringify(below.findings));
});
