/**
 * Curated, read-only Wisman Farm records for UI and reconciliation testing.
 *
 * The source workbook is maintained outside this repository. Keeping a small
 * fixture here makes the dashboard preview deterministic without uploading or
 * silently persisting the source report. Values are intentionally kept at the
 * daily cage grain; consumers must not treat them as weekly farm_data rows.
 */

export const WISMAN_FIXTURE_META = {
  name: "Wisman Farm",
  source: "Daily Flock Report · Laporan Evaluasi Aplikasi Pihak Ketiga",
  sourcePath: "Laporan Evaluasi Aplikasi Pihak Ketiga/Data wisman Farm",
  status: "preview-only",
  coverage: "10 baris · 2 tanggal · 5 kandang",
};

/**
 * These rows mirror the two supplied OCR extracts (2026-07-12 and
 * 2026-08-20). Review status is part of the fixture contract: only
 * SIAP_DIREKONSILIASI rows are eligible for aggregate preview metrics.
 */
export const WISMAN_FIXTURE_ROWS = [
  {
    id: "wisman-2026-07-12-ade-1",
    date: "2026-07-12",
    employee: "Ade",
    cage: "Kandang 1",
    ageWeeks: 101,
    early: 1505,
    increase: 0,
    decrease: 0,
    end: 1505,
    tb: 990,
    tr: 20,
    tp: 206,
    totalEgg: 1216,
    productionPct: 80.8,
    consumption: 191,
    intake: 127,
    diet: "MXCAL936JGDD",
    confidence: 61.38,
    reviewStatus: "PERLU_REVIEW",
    reviewNotes: "Konsumsi pakan diselaraskan dengan baris Summary; verifikasi visual.",
  },
  {
    id: "wisman-2026-07-12-ade-2",
    date: "2026-07-12",
    employee: "Ade",
    cage: "Kandang 2",
    ageWeeks: 101,
    early: 1481,
    increase: 0,
    decrease: 0,
    end: 1481,
    tb: 1045,
    tr: 18,
    tp: 132,
    totalEgg: 1195,
    productionPct: 80.69,
    consumption: 186,
    intake: 126,
    diet: "MXCAL936JGDD",
    confidence: 54.09,
    reviewStatus: "PERLU_REVIEW",
    reviewNotes: "Confidence OCR rendah (54,1%).",
  },
  {
    id: "wisman-2026-07-12-ade-3",
    date: "2026-07-12",
    employee: "Ade",
    cage: "Kandang 3",
    ageWeeks: 101,
    early: 1481,
    increase: 0,
    decrease: 3,
    end: 1478,
    tb: 1050,
    tr: 10,
    tp: 107,
    totalEgg: 1167,
    productionPct: 78.96,
    consumption: 186,
    intake: 126,
    diet: "MXCAL936JGDD",
    confidence: 66.92,
    reviewStatus: "PERLU_REVIEW",
    reviewNotes: "Produksi sumber berbeda dari hasil hitung; cek formula/KPI.",
  },
  {
    id: "wisman-2026-07-12-nur-4",
    date: "2026-07-12",
    employee: "Nur",
    cage: "Kandang 4",
    ageWeeks: 32,
    early: 1387,
    increase: 0,
    decrease: 0,
    end: 1387,
    tb: 1250,
    tr: 3,
    tp: 0,
    totalEgg: 1253,
    productionPct: 90.34,
    consumption: 170,
    intake: 123,
    diet: "MXCAL936JGDD",
    confidence: 58.18,
    reviewStatus: "SIAP_DIREKONSILIASI",
    reviewNotes: "",
  },
  {
    id: "wisman-2026-07-12-nur-5",
    date: "2026-07-12",
    employee: "Nur",
    cage: "Kandang 5",
    ageWeeks: 32,
    early: 1718,
    increase: 0,
    decrease: 0,
    end: 1718,
    tb: 1476,
    tr: 3,
    tp: 0,
    totalEgg: 1479,
    productionPct: 86.09,
    consumption: 215,
    intake: 125,
    diet: "MXCAL936JGDD",
    confidence: 62.78,
    reviewStatus: "SIAP_DIREKONSILIASI",
    reviewNotes: "",
  },
  {
    id: "wisman-2026-08-20-ade-1",
    date: "2026-08-20",
    employee: "Ade",
    cage: "Kandang 1",
    ageWeeks: 106,
    early: 76,
    increase: 0,
    decrease: 1,
    end: 75,
    tb: 24,
    tr: 6,
    tp: 0,
    totalEgg: 30,
    productionPct: 40,
    consumption: 1,
    intake: 13,
    diet: "MXCAL936JGDD",
    confidence: 45.88,
    reviewStatus: "PERLU_REVIEW",
    reviewNotes: "Confidence OCR rendah (45,9%).",
  },
  {
    id: "wisman-2026-08-20-ade-2",
    date: "2026-08-20",
    employee: "Ade",
    cage: "Kandang 2",
    ageWeeks: 106,
    early: 75,
    increase: 0,
    decrease: 2,
    end: 73,
    tb: 23,
    tr: 2,
    tp: 0,
    totalEgg: 25,
    productionPct: 34.25,
    consumption: 1,
    intake: 14,
    diet: "MXCAL936JGDD",
    confidence: 68.21,
    reviewStatus: "SIAP_DIREKONSILIASI",
    reviewNotes: "",
  },
  {
    id: "wisman-2026-08-20-ade-3",
    date: "2026-08-20",
    employee: "Ade",
    cage: "Kandang 3",
    ageWeeks: 106,
    early: 1211,
    increase: 0,
    decrease: 1152,
    end: 59,
    tb: 23,
    tr: 0,
    tp: 0,
    totalEgg: 23,
    productionPct: 46,
    consumption: 1,
    intake: 17,
    diet: "MXCAL936JGDD",
    confidence: 49.45,
    reviewStatus: "PERLU_REVIEW",
    reviewNotes: "Nilai diselaraskan dengan Summary; verifikasi visual dan formula.",
  },
  {
    id: "wisman-2026-08-20-nur-4",
    date: "2026-08-20",
    employee: "Nur",
    cage: "Kandang 4",
    ageWeeks: 38,
    early: 1379,
    increase: 0,
    decrease: 0,
    end: 1379,
    tb: 1277,
    tr: 3,
    tp: 0,
    totalEgg: 1280,
    productionPct: 92.82,
    consumption: 160,
    intake: 116,
    diet: "MXCAL936JGDD",
    confidence: 56.52,
    reviewStatus: "SIAP_DIREKONSILIASI",
    reviewNotes: "",
  },
  {
    id: "wisman-2026-08-20-nur-5",
    date: "2026-08-20",
    employee: "Nur",
    cage: "Kandang 5",
    ageWeeks: 38,
    early: 1693,
    increase: 0,
    decrease: 2,
    end: 1691,
    tb: 1564,
    tr: 3,
    tp: 0,
    totalEgg: 1567,
    productionPct: 92.67,
    consumption: 205,
    intake: 121,
    diet: "MXCAL936JGDD",
    confidence: 69.64,
    reviewStatus: "SIAP_DIREKONSILIASI",
    reviewNotes: "",
  },
];

export const wismanReviewedRows = WISMAN_FIXTURE_ROWS.filter(
  (row) => row.reviewStatus === "SIAP_DIREKONSILIASI",
);

/** Aggregate only reconciled rows for a truthful two-point visual preview. */
export function aggregateWismanByDate(rows = wismanReviewedRows) {
  const byDate = new Map();

  rows.forEach((row) => {
    const current = byDate.get(row.date) || {
      id: `wisman-${row.date}`,
      date: row.date,
      week: row.ageWeeks,
      henDayProduction: [],
      mortality: [],
      populationEnd: 0,
      eggCount: 0,
      feedIntake: [],
      source: "Wisman preview",
    };

    current.henDayProduction.push(row.productionPct);
    current.mortality.push(row.end ? (row.decrease / row.end) * 100 : 0);
    current.populationEnd += row.end;
    current.eggCount += row.totalEgg;
    current.feedIntake.push(row.intake);
    byDate.set(row.date, current);
  });

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      henDayProduction: average(row.henDayProduction),
      mortality: average(row.mortality),
      feedIntake: average(row.feedIntake),
    }));
}

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}
