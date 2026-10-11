// Weekly KPI reading shared by Farm KPI and the learner home: which
// indicators a farm reads, how a change is judged, and APPI's summary of the
// latest week. Presentation-free.

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export const formatNumber = (value, digits = 1) => Number(value).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const formatMillion = (value) => `Rp ${formatNumber(value / 1e6, 1)} jt`;

/**
 * The indicators a farm reads every week. `better` says which direction is
 * good, so a change is coloured by meaning, not by sign. FCR carries the same
 * general reference band as the calculator.
 */
export const KPI_METRICS = [
  { id: "hdp", label: "HDP", long: "Hen day production", hue: "orange", icon: "chart", better: "up", read: (row) => toNumber(row.henDayProduction), format: (value) => `${formatNumber(value, 1)}%`, delta: (value) => `${formatNumber(Math.abs(value), 1)} poin` },
  { id: "fcr", label: "FCR", long: "Feed conversion ratio", hue: "green", icon: "scale", better: "down", read: (row) => toNumber(row.fcr), format: (value) => formatNumber(value, 2), delta: (value) => formatNumber(Math.abs(value), 2), band: { from: 1.6, to: 2.2, label: "acuan sangat baik ≤ 2,2" } },
  { id: "egg", label: "Berat telur", long: "Berat telur rata-rata", hue: "violet", icon: "egg", better: "up", read: (row) => toNumber(row.eggWeight), format: (value) => `${formatNumber(value, 1)} g`, delta: (value) => `${formatNumber(Math.abs(value), 1)} g` },
  { id: "mortality", label: "Mortalitas", long: "Mortalitas mingguan", hue: "rose", icon: "heart", better: "down", read: (row) => toNumber(row.mortality), format: (value) => `${formatNumber(value, 2)}%`, delta: (value) => `${formatNumber(Math.abs(value), 2)} poin` },
  { id: "feed", label: "Pakan", long: "Asupan pakan per ekor", hue: "teal", icon: "feed", better: null, read: (row) => toNumber(row.feedIntake), format: (value) => `${formatNumber(value, 0)} g`, delta: (value) => `${formatNumber(Math.abs(value), 0)} g` },
  { id: "profit", label: "Laba", long: "Pendapatan dikurangi biaya", hue: "blue", icon: "wallet", better: "up", read: (row) => toNumber(row.revenue) - toNumber(row.cost), format: formatMillion, delta: (value) => formatMillion(Math.abs(value)) },
];

/** Rows in week order. */
export function sortByWeek(rows = []) {
  return [...rows].sort((a, b) => toNumber(a.week) - toNumber(b.week));
}

/** Latest finite reading, the one before it, and the change between them. */
export function readingFor(rows, metric) {
  const points = rows.map((row) => ({ week: row.week, value: metric.read(row) })).filter((point) => Number.isFinite(point.value));
  const latest = points[points.length - 1] || null;
  const previous = points[points.length - 2] || null;
  const change = latest && previous ? latest.value - previous.value : null;
  const sentiment = change === null || change === 0 || !metric.better ? "neutral" : (change > 0) === (metric.better === "up") ? "positive" : "negative";
  return { latest, previous, change, sentiment, values: points.map((point) => point.value), points };
}

/** APPI's reading of the latest week: a mood, a headline, up to three findings and the number of concerns. */
export function weeklyReading(rows) {
  const week = rows.length ? rows[rows.length - 1].week : null;
  const readings = KPI_METRICS.map((metric) => ({ metric, ...readingFor(rows, metric) })).filter((item) => item.latest && item.latest.week === week);
  const comparable = readings.filter((item) => item.change !== null && item.metric.better);
  if (!readings.length) {
    return { week, mood: "data", concerns: 0, title: "Data minggu ini belum lengkap", findings: [{ tone: "neutral", text: "Isi indikator minggu ini agar APPI bisa membacanya. Angka terakhir tetap tersedia di setiap indikator." }] };
  }
  if (!comparable.length) {
    return { week, mood: "data", concerns: 0, title: "Belum cukup data untuk dibandingkan", findings: [{ tone: "neutral", text: "Catat indikator yang sama pada minggu berikutnya agar APPI bisa membaca arah perubahan." }] };
  }
  const relative = (item) => Math.abs(item.change / (item.previous.value || 1));
  const findings = [...comparable].sort((a, b) => relative(b) - relative(a)).slice(0, 3).map(({ metric, change, latest, sentiment }) => ({
    tone: sentiment,
    metric: metric.id,
    text: change === 0 ? `${metric.label} stabil di ${metric.format(latest.value)}.` : `${metric.label} ${change > 0 ? "naik" : "turun"} ${metric.delta(change)} menjadi ${metric.format(latest.value)}.`,
  }));
  const fcr = readings.find((item) => item.metric.id === "fcr");
  const fcrConcern = fcr && fcr.latest.value > 2.6;
  if (fcrConcern) findings.unshift({ tone: "negative", metric: "fcr", text: `FCR ${fcr.metric.format(fcr.latest.value)} di atas acuan 2,6. Cek pakan tercecer dan kualitas ransum.` });
  const negatives = comparable.filter((item) => item.sentiment === "negative").length + (fcrConcern && fcr.sentiment !== "negative" ? 1 : 0);
  const mood = negatives === 0 ? "happy" : negatives === 1 ? "think" : "concerned";
  const title = negatives === 0 ? "Minggu ini terlihat sehat" : negatives === 1 ? "Ada satu hal untuk dicek" : `${negatives} indikator perlu perhatian`;
  return { week, mood, concerns: negatives, title, findings: findings.slice(0, 3) };
}

/** The question APPI receives when the learner asks it to read the week. */
export function kpiPrompt(rows, reading) {
  const last = rows[rows.length - 1] || {};
  const parts = KPI_METRICS.map((metric) => {
    const value = metric.read(last);
    return Number.isFinite(value) ? `${metric.label} ${metric.format(value)}` : null;
  }).filter(Boolean).join(", ");
  return `Tolong baca KPI flock saya minggu ke-${reading.week}: ${parts}. ${reading.findings.map((item) => item.text).join(" ")} Apa tiga pemeriksaan prioritas di kandang minggu ini?`;
}
