// Curriculum reference rules shared by the calculators and the weekly KPI reading.
// The curriculum document fixes them: a value exactly on a boundary belongs to the next band.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chapterOptions, getLevelForModule, learningLevels } from "../src/lib/academyData.js";
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

test("chapter names follow the curriculum document, and a name saved on the modules wins", () => {
  assert.deepEqual(learningLevels.map((level) => level.name), ["Foundation", "Pondasi", "Layer Management", "Nutrition", "Water Management", "Environment & Closed House", "Health & Veterinary", "Biosecurity", "Egg Management", "Farm Data & KPI", "Farm Economics", "Farm Management", "Advanced Management", "Expert Level"]);
  const modules = [{ moduleNumber: 3, level: 2, levelName: "Kandang & Pullet" }];
  assert.equal(chapterOptions(modules)[1].name, "Kandang & Pullet");
  assert.equal(chapterOptions(modules)[0].name, "Foundation");
  assert.equal(getLevelForModule(modules[0]).name, "Kandang & Pullet");
  assert.equal(getLevelForModule({ level: 2 }).name, "Pondasi");
});

test("each calculator links to the lesson that teaches it", () => {
  const titles = JSON.parse(readFileSync("scripts/curriculum/data/2026-10-30-kurikulum-produksi.json", "utf8")).modules.map((module) => module.fields.title);
  const source = readFileSync("src/pages/Calculators.jsx", "utf8");
  const links = [...source.matchAll(/id: "(\w+)",[\s\S]*?module: (\/.+?\/i),/g)].map((match) => [match[1], new RegExp(match[2].slice(1, -2), "i")]);
  assert.equal(links.length, 12);
  const lesson = Object.fromEntries(links.map(([id, pattern]) => [id, titles.find((title) => pattern.test(title))]));
  for (const [id, title] of Object.entries(lesson)) assert.ok(title, id);
  assert.equal(lesson.roi, "Break Even, ROI, dan Cashflow");
});

test("the catalogue filter reads chapter names from every module, not the filtered list", () => {
  const source = readFileSync("src/pages/Modules.jsx", "utf8");
  assert.match(source, /chapterOptions\(curriculum\.flatMap\(\(item\) => item\.modules\)\)/);
});

test("a tier's modules are never described as a continuous range", () => {
  for (const file of ["src/pages/Quiz.jsx", "src/pages/Modules.jsx", "src/pages/Home.jsx", "src/pages/Certification.jsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /modules\[0\]\}\s*[–-]\s*\{/, file);
  }
});
