import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulateFarmWeeks, simulateToolValues, SIMULATION_SCENARIOS, SIMULATION_WEEK_OPTIONS } from "../src/lib/farmSimulation.js";
import { fcrZone, sortByWeek, weeklyReading } from "../src/lib/kpiReading.js";

test("a simulation is the same every time, so a reload does not change the numbers", () => {
  assert.deepEqual(simulateFarmWeeks({ weeks: 8, scenario: "normal" }), simulateFarmWeeks({ weeks: 8, scenario: "normal" }));
  assert.notDeepEqual(simulateFarmWeeks({ weeks: 8, scenario: "normal" }), simulateFarmWeeks({ weeks: 8, scenario: "panas" }));
});

test("every week has the row shape the page reads and stays inside what the entry form accepts", () => {
  for (const weeks of SIMULATION_WEEK_OPTIONS) {
    for (const scenario of Object.keys(SIMULATION_SCENARIOS)) {
      const rows = simulateFarmWeeks({ weeks, scenario });
      assert.equal(rows.length, weeks);
      rows.forEach((row, index) => {
        assert.equal(row.simulated, true);
        assert.equal(row.id, `sim-${row.week}`);
        assert.equal(row.week, 30 + index);
        assert.ok(Number.isInteger(row.week) && row.week >= 1);
        assert.ok(row.henDayProduction > 80 && row.henDayProduction <= 100, `HDP ${row.henDayProduction}`);
        assert.ok(row.mortality >= 0 && row.mortality <= 100);
        assert.ok(row.humidity >= 0 && row.humidity <= 100);
        assert.ok(row.eggWeight > 55 && row.eggWeight < 70);
        assert.ok(row.feedIntake > 95 && row.feedIntake < 125);
        assert.ok(row.revenue > row.cost * 0.8, "a laying flock does not lose this much in a normal week");
        const expected = row.feedIntake / ((row.henDayProduction / 100) * row.eggWeight);
        assert.ok(Math.abs(row.fcr - expected) < 0.006, "FCR comes from the same formula as the entry form");
      });
    }
  }
});

test("the normal flock reads as healthy and the heat scenario gives APPI something to flag", () => {
  for (const weeks of SIMULATION_WEEK_OPTIONS) {
    const healthy = simulateFarmWeeks({ weeks, scenario: "normal" });
    assert.equal(fcrZone(healthy.at(-1).fcr).tone === "act", false);
    const calm = weeklyReading(sortByWeek(healthy));
    assert.equal(calm.concerns, 0, `${weeks} minggu: ${calm.title}`);

    const stressed = simulateFarmWeeks({ weeks, scenario: "panas" });
    const before = stressed.at(-3);
    const after = stressed.at(-1);
    const profit = (row) => row.revenue - row.cost;
    assert.ok(after.temperature > before.temperature + 3);
    assert.ok(after.waterIntake > before.waterIntake);
    assert.ok(after.henDayProduction < before.henDayProduction - 2);
    assert.ok(profit(after) < profit(stressed.at(-2)) && profit(stressed.at(-2)) < profit(before), "heat costs money, week after week");
    const reading = weeklyReading(sortByWeek(stressed));
    assert.ok(reading.concerns >= 2, `${weeks} minggu: ${reading.title}`);
    assert.ok(!reading.findings.some((item) => item.metric === "profit" && item.tone === "positive"));
    assert.match(after.notes, /panas/i);
  }
});

test("a calculator simulation moves one field, step by step, and keeps the others on their example", () => {
  const fields = [{ key: "eggs", example: 4550 }, { key: "hens", example: 4900 }, { key: "fcr", example: 2.2 }];
  const seen = new Set();
  for (let step = 1; step <= 6; step += 1) {
    const values = simulateToolValues(fields, step);
    assert.equal(values.hens, "4900");
    assert.equal(values.fcr, "2.2");
    assert.ok(Math.abs(Number(values.eggs) / 4550 - 1) <= 0.061);
    assert.ok(Number.isInteger(Number(values.eggs)));
    seen.add(values.eggs);
  }
  assert.ok(seen.size >= 4, "each week gives a different result");
  assert.equal(simulateToolValues([{ key: "fcr", example: 2.2 }], 2).fcr.split(".")[1]?.length <= 2, true);
});

test("the simulation cannot reach the saved data, points, or the chat context", () => {
  const page = readFileSync(new URL("../src/pages/KpiDashboard.jsx", import.meta.url), "utf8");
  assert.match(page, /const rows = useMemo\(\(\) => \(simulation \? simulateFarmWeeks\(simulation\) : savedRows\)/);
  assert.match(page, /\{simulation \|\| !hasData \? null : \(/, "the entry button leaves while a simulation runs");
  assert.match(page, /simulation \? columns\.filter\(\(column\) => column\.key !== "actions"\)/, "simulated weeks have no edit or delete");
  assert.ok(!readFileSync(new URL("../src/lib/farmSimulation.js", import.meta.url), "utf8").includes("nativeApi"));
});
