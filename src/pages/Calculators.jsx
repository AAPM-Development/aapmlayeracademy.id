import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { Ic } from "@/design-system/canvas";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";
import { askAppi } from "@/lib/askAppi";
import { useFarmData, useModules } from "@/lib/useCourseData";
import { simulateToolValues } from "@/lib/farmSimulation";
import { getLevelForModule, sortModules } from "@/lib/academyData";
import { FCR_ZONES, formatNumber, sortByWeek, toNumber } from "@/lib/kpiReading";
import { cn } from "@/lib/utils";
import { moduleNo } from "@/lib/moduleNumber";

const rupiah = (value) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const decimal = (value) => String(value).replace(".", ",");

// Readings use the same general references across tools: "good" (green),
// "watch" (amber, "Wajar") and "act" (rose). Each zone carries an icon, a
// name and its range so the verdict never depends on colour alone. They are
// starting points for a walk through the house, never the strain standard.
const TONE = {
  good: { hue: "green", ic: "check-circle", mood: "happy", verdict: "verdict-good", text: "t-success" },
  watch: { hue: "amber", ic: "eye", mood: "think", verdict: "verdict-watch", text: "t-warning" },
  act: { hue: "rose", ic: "alert", mood: "concerned", verdict: "verdict-act", text: "t-danger" },
  info: { hue: "blue", ic: "info", mood: "talk", verdict: "verdict-info", text: "t-ink" },
};

/**
 * Each tool declares its inputs and a `compute` that returns null until the
 * required numbers are usable. `scale` places the result on a reference bar
 * whose zones also give the verdict; tools without a scale give an `info`
 * reading. `module` finds the matching lesson; `kpi` the Farm KPI reading.
 */
const tools = [
  {
    id: "fcr",
    name: "FCR",
    title: "Feed Conversion Ratio (FCR)",
    ic: "chart",
    hue: "green",
    description: "Efisiensi pakan terhadap egg mass.",
    lead: "Berapa kg pakan yang dibutuhkan untuk menghasilkan 1 kg telur. Makin rendah, makin efisien.",
    formula: ["FCR = Total pakan (kg) ÷ Egg mass (kg)", "Egg mass = Jumlah telur × Berat telur (g) ÷ 1000"],
    fields: [
      { key: "feed", label: "Total konsumsi pakan", unit: "kg", example: 120, hint: "Untuk periode yang sama dengan jumlah telur." },
      { key: "eggs", label: "Jumlah telur", unit: "butir", example: 850 },
      { key: "eggWeight", label: "Berat rata-rata telur", unit: "gram", example: 60, hint: "Timbang sampel 30 butir" },
    ],
    compute: ({ feed, eggs, eggWeight }) => {
      const eggMass = (eggs * eggWeight) / 1000;
      if (!(feed > 0 && eggMass > 0)) return null;
      return { value: feed / eggMass, details: [["Egg mass", `${formatNumber(eggMass, 1)} kg`]], short: `egg mass ${formatNumber(eggMass, 1)} kg` };
    },
    format: (value) => formatNumber(value, 2),
    unitLong: "kg pakan per kg telur",
    module: /FCR|Egg Mass|Benchmark/i,
    kpi: { field: "fcr", label: "FCR", digits: 2 },
    scale: {
      min: 1.6,
      max: 3.2,
      zones: FCR_ZONES,
    },
  },
  {
    id: "eggmass",
    name: "Egg Mass",
    title: "Egg Mass per Ekor per Hari",
    ic: "egg",
    hue: "orange",
    description: "Output telur per ekor per hari.",
    lead: "Gabungan produksi dan berat telur dalam gram per ekor per hari.",
    formula: ["Egg mass = HDP (%) × Berat telur (g) ÷ 100"],
    fields: [
      { key: "hdp", label: "Hen Day Production", unit: "%", example: 90 },
      { key: "eggWeight", label: "Berat telur", unit: "gram", example: 60 },
    ],
    compute: ({ hdp, eggWeight }) => (hdp > 0 && eggWeight > 0 ? { value: (hdp * eggWeight) / 100 } : null),
    format: (value) => formatNumber(value, 1),
    unit: "g/ekor/hari",
    unitLong: "gram per ekor per hari",
    module: /Egg Mass|FCR|Produksi/i,
    kpi: { field: "henDayProduction", label: "HDP", digits: 1, suffix: "%" },
    scale: {
      min: 40,
      max: 66,
      zones: [
        { upTo: 50, tone: "act", label: "Di bawah target", note: "Evaluasi produksi dan berat telur bersama." },
        { upTo: 57, tone: "watch", label: "Wajar", note: "Bandingkan dengan target umur strain." },
        { upTo: Infinity, tone: "good", label: "Excellent", note: "Mendekati target puncak strain; pastikan berat telur sesuai umur." },
      ],
    },
  },
  {
    id: "hdp",
    name: "HDP",
    title: "Hen Day & Hen Housed Production",
    ic: "trend-up",
    hue: "green",
    description: "Produksi telur harian per ekor.",
    lead: "Berapa persen ayam yang hidup hari ini bertelur. Hen housed membandingkan dengan populasi awal kandang.",
    formula: ["HDP = Telur hari ini ÷ Ayam hidup hari ini × 100", "Hen housed = Telur hari ini ÷ Populasi awal × 100"],
    fields: [
      { key: "eggs", label: "Telur dipanen hari ini", unit: "butir", example: 4550 },
      { key: "hens", label: "Ayam hidup hari ini", unit: "ekor", example: 4900 },
      { key: "housed", label: "Populasi awal kandang", unit: "ekor", example: 5000, optional: true },
    ],
    compute: ({ eggs, hens, housed }) => {
      if (!(eggs > 0 && hens > 0)) return null;
      if (eggs > hens) return { invalid: "Telur hari ini tidak bisa lebih banyak dari ayam yang hidup. Cek kembali angkanya." };
      const details = housed > 0 ? [["Hen housed", `${formatNumber((eggs / housed) * 100, 1)}%`]] : [];
      return { value: (eggs / hens) * 100, details, short: housed > 0 ? `hen housed ${formatNumber((eggs / housed) * 100, 1)}%` : "" };
    },
    format: (value) => formatNumber(value, 1),
    unit: "%",
    unitLong: "persen ayam hidup bertelur",
    module: /Manajemen Produksi/i,
    kpi: { field: "henDayProduction", label: "HDP", digits: 1, suffix: "%" },
    scale: {
      min: 60,
      max: 100,
      zones: [
        { upTo: 80, tone: "act", label: "Di bawah target", note: "Bandingkan dengan kurva strain sesuai umur; cek pakan, air, cahaya, dan kesehatan." },
        { upTo: 90, tone: "watch", label: "Wajar", note: "Wajar di awal atau akhir produksi; pantau tren mingguannya." },
        { upTo: Infinity, tone: "good", label: "Puncak", note: "Setara masa puncak produksi layer komersial." },
      ],
    },
  },
  {
    id: "feedintake",
    name: "Konsumsi Pakan",
    title: "Konsumsi Pakan per Ekor per Hari",
    ic: "feed",
    hue: "teal",
    description: "Gram pakan per ekor per hari.",
    lead: "Rata-rata pakan yang dimakan tiap ayam per hari. Perubahan mendadak sering jadi sinyal pertama masalah.",
    formula: ["Konsumsi = Pakan habis per hari (kg) × 1000 ÷ Jumlah ayam"],
    fields: [
      { key: "feed", label: "Pakan habis per hari", unit: "kg", example: 560, hint: "Pakan diberikan dikurangi sisa di tempat pakan." },
      { key: "hens", label: "Jumlah ayam", unit: "ekor", example: 4900 },
    ],
    compute: ({ feed, hens }) => (feed > 0 && hens > 0 ? { value: (feed * 1000) / hens } : null),
    format: (value) => formatNumber(value, 0),
    unit: "g/ekor/hari",
    unitLong: "gram pakan per ekor per hari",
    module: /Nutrisi/i,
    kpi: { field: "feedIntake", label: "Konsumsi pakan", digits: 0, suffix: " g" },
    scale: {
      min: 80,
      max: 140,
      zones: [
        { upTo: 100, tone: "watch", label: "Rendah", note: "Cek akses pakan, palatabilitas, suhu kandang, dan kesehatan flock." },
        { upTo: 125, tone: "good", label: "Normal", note: "Sesuai kebutuhan layer masa produksi." },
        { upTo: Infinity, tone: "act", label: "Tinggi", note: "Cek pakan tercecer, tikus atau burung liar, dan energi ransum." },
      ],
    },
  },
  {
    id: "uniformity",
    name: "Uniformity",
    title: "Uniformity (%)",
    ic: "scale",
    hue: "blue",
    description: "Konsistensi bobot flock.",
    lead: "Persentase ayam yang bobotnya dalam ±10% dari rata-rata flock.",
    formula: ["Uniformity = Ayam dalam ±10% berat rata-rata ÷ Total ditimbang × 100"],
    fields: [
      { key: "average", label: "Berat rata-rata", unit: "gram", example: 1500, optional: true },
      { key: "within", label: "Ayam dalam ±10%", unit: "ekor", example: 82 },
      { key: "total", label: "Total ayam ditimbang", unit: "ekor", example: 100, hint: "Timbang acak minimal 100 ekor" },
    ],
    compute: ({ within, total }) => (total > 0 && within > 0 ? { value: Math.min(100, (within / total) * 100) } : null),
    format: (value) => `${Math.round(value)}`,
    unit: "%",
    unitLong: "persen flock seragam",
    module: /Uniform|Growing|Pre-Lay/i,
    scale: {
      min: 50,
      max: 100,
      zones: [
        { upTo: 75, tone: "act", label: "Rendah", note: "Pertimbangkan grading, seleksi, atau culling." },
        { upTo: 85, tone: "watch", label: "Wajar", note: "Jaga akses pakan dan kepadatan merata." },
        { upTo: Infinity, tone: "good", label: "Excellent", note: "Bobot flock seragam." },
      ],
    },
  },
  {
    id: "density",
    name: "Kepadatan",
    title: "Kepadatan Kandang Baterai",
    ic: "grid",
    hue: "violet",
    description: "Ruang per ekor di dalam kandang.",
    lead: "Luas lantai kandang yang didapat tiap ayam. Terlalu padat menurunkan produksi dan menaikkan stres.",
    formula: ["Ruang per ekor (cm²) = Panjang × Lebar kandang (cm) ÷ Ayam per kandang", "Ekor per m² = 10.000 ÷ Ruang per ekor"],
    fields: [
      { key: "length", label: "Panjang kandang", unit: "cm", example: 40 },
      { key: "width", label: "Lebar (kedalaman) kandang", unit: "cm", example: 45 },
      { key: "birds", label: "Ayam per kandang", unit: "ekor", example: 4 },
    ],
    compute: ({ length, width, birds }) => {
      if (!(length > 0 && width > 0 && birds > 0)) return null;
      const perBird = (length * width) / birds;
      return { value: perBird, details: [["Ekor per m²", formatNumber(10000 / perBird, 1)]], short: `${formatNumber(10000 / perBird, 1)} ekor/m²` };
    },
    format: (value) => formatNumber(value, 0),
    unit: "cm²/ekor",
    unitLong: "cm² lantai per ekor",
    module: /Manajemen Produksi/i,
    scale: {
      min: 300,
      max: 700,
      zones: [
        { upTo: 400, tone: "act", label: "Terlalu padat", note: "Kurangi isi kandang; kepadatan ini menekan produksi dan kualitas kerabang." },
        { upTo: 450, tone: "watch", label: "Batas", note: "Masih dipakai di lapangan; jaga akses pakan dan air tiap ayam." },
        { upTo: Infinity, tone: "good", label: "Lega", note: "Ruang cukup untuk makan, minum, dan istirahat." },
      ],
    },
  },
  {
    id: "mortality",
    name: "Mortality",
    title: "Mortality & Livability",
    ic: "heart",
    hue: "rose",
    description: "Kehilangan dan livability.",
    lead: "Persentase ayam yang mati dari populasi awal, dan sisanya yang bertahan.",
    formula: ["Mortality = Jumlah mati ÷ Populasi awal × 100", "Livability = 100 − Mortality"],
    fields: [
      // Zero deaths is a real answer, so this field may be 0.
      { key: "dead", label: "Jumlah ayam mati", unit: "ekor", example: 15, allowZero: true },
      { key: "start", label: "Populasi awal", unit: "ekor", example: 5000 },
    ],
    compute: ({ dead, start }) => {
      if (!(start > 0) || !(dead >= 0)) return null;
      const mortality = (dead / start) * 100;
      return { value: mortality, details: [["Livability", `${formatNumber(100 - mortality, 1)}%`]], short: `livability ${formatNumber(100 - mortality, 1)}%` };
    },
    format: (value) => formatNumber(value, 2),
    unit: "%",
    unitLong: "persen dari populasi awal",
    module: /Kesehatan|Health|Biosecurity|Mortal/i,
    kpi: { field: "mortality", label: "Mortalitas", digits: 2, suffix: "%" },
    scale: {
      min: 0,
      max: 8,
      zones: [
        { upTo: 1, tone: "good", label: "Baik", note: "Di bawah ambang normal." },
        { upTo: 5, tone: "watch", label: "Pantau", note: "Catat penyebab kematian per hari." },
        { upTo: Infinity, tone: "act", label: "Tinggi", note: "Investigasi penyebab dan konsultasikan dengan dokter hewan." },
      ],
    },
  },
  {
    id: "eggquality",
    name: "Kualitas Telur",
    title: "Telur Retak & Kotor",
    ic: "target",
    hue: "orange",
    description: "Persentase telur turun kelas.",
    lead: "Bagian produksi yang tidak bisa dijual sebagai telur utuh dan bersih.",
    formula: ["Turun kelas = (Telur retak + Telur kotor) ÷ Total telur × 100"],
    fields: [
      { key: "total", label: "Total telur dipanen", unit: "butir", example: 4550 },
      { key: "cracked", label: "Telur retak/pecah", unit: "butir", example: 55, allowZero: true },
      { key: "dirty", label: "Telur kotor", unit: "butir", example: 40, allowZero: true },
    ],
    compute: ({ total, cracked, dirty }) => {
      if (!(total > 0) || !(cracked >= 0) || !(dirty >= 0)) return null;
      if (cracked + dirty > total) return { invalid: "Telur retak dan kotor tidak bisa melebihi total telur yang dipanen." };
      return {
        value: ((cracked + dirty) / total) * 100,
        details: [["Retak", `${formatNumber((cracked / total) * 100, 1)}%`], ["Kotor", `${formatNumber((dirty / total) * 100, 1)}%`]],
        short: `retak ${formatNumber((cracked / total) * 100, 1)}%`,
      };
    },
    format: (value) => formatNumber(value, 1),
    unit: "%",
    unitLong: "persen telur turun kelas",
    module: /Egg Collection|Egg Quality/i,
    scale: {
      min: 0,
      max: 8,
      zones: [
        { upTo: 2, tone: "good", label: "Baik", note: "Penanganan dan kualitas kerabang terjaga." },
        { upTo: 4, tone: "watch", label: "Pantau", note: "Cek frekuensi koleksi, kemiringan lantai kandang, dan kalsium pakan." },
        { upTo: Infinity, tone: "act", label: "Tinggi", note: "Telusuri titik retak (kandang, koleksi, packing) dan kualitas kerabang per umur." },
      ],
    },
  },
  {
    id: "waterfeed",
    name: "Water/Feed",
    title: "Water/Feed Ratio",
    ic: "drop",
    hue: "teal",
    description: "Perubahan konsumsi air dan pakan.",
    lead: "Perbandingan air minum dan pakan per ekor; normal 1,8–2,2.",
    formula: ["Rasio = Konsumsi air (ml) ÷ Konsumsi pakan (g)"],
    fields: [
      { key: "water", label: "Konsumsi air", unit: "ml/ekor", example: 220 },
      { key: "feed", label: "Konsumsi pakan", unit: "g/ekor", example: 115 },
    ],
    compute: ({ water, feed }) => (water > 0 && feed > 0 ? { value: water / feed } : null),
    format: (value) => formatNumber(value, 2),
    unitLong: "ml air per g pakan",
    module: /Air Minum|Water/i,
    scale: {
      min: 1.2,
      max: 3,
      zones: [
        { upTo: 1.8, tone: "watch", label: "Rendah", note: "Cek akses air, nipple, dan kualitas air." },
        { upTo: 2.2, tone: "good", label: "Normal", note: "Konsumsi air dan pakan seimbang." },
        { upTo: Infinity, tone: "act", label: "Tinggi", note: "Cek suhu kandang, stres panas, dan kebocoran." },
      ],
    },
  },
  {
    id: "ventilation",
    name: "Ventilasi",
    title: "Kebutuhan Ventilasi & Jumlah Fan",
    ic: "wind",
    hue: "violet",
    description: "Volume kandang menjadi airflow.",
    lead: "Perkiraan airflow minimum dan tunnel dari berat hidup flock.",
    formula: ["Ventilasi minimum (m³/menit) = Berat total (kg) × 0,014", "Tunnel = Berat total × 0,07 · Fan 36″ ≈ 340 m³/menit"],
    fields: [
      { key: "birds", label: "Jumlah ayam", unit: "ekor", example: 5000 },
      { key: "weight", label: "Berat rata-rata", unit: "gram", example: 1800 },
      { key: "temp", label: "Suhu lingkungan", unit: "°C", example: 30, optional: true },
    ],
    // Rule of thumb: minimum (cold) 0.014 and tunnel (hot) 0.07 m³/min per kg live weight; a 36″ fan moves ≈ 340 m³/min.
    compute: ({ birds, weight, temp }) => {
      if (!(birds > 0 && weight > 0)) return null;
      const kg = birds * (weight / 1000);
      const tunnel = kg * 0.07;
      return {
        value: Math.ceil(tunnel / 340),
        note: "Perkiraan; sesuaikan dengan static pressure dan desain kandang.",
        details: [
          ["Berat total", `${formatNumber(kg, 0)} kg`],
          ["Ventilasi minimum", `${formatNumber(kg * 0.014, 1)} m³/menit`],
          [temp > 0 ? `Tunnel (${temp}°C)` : "Tunnel", `${formatNumber(tunnel, 1)} m³/menit`],
        ],
        short: `tunnel ${formatNumber(tunnel, 0)} m³/menit`,
      };
    },
    format: (value) => `${Math.round(value)}`,
    unit: "fan 36″",
    unitLong: "fan 36″ untuk mode tunnel",
    module: /Ventilasi|Suhu|Closed House/i,
  },
  {
    id: "hpp",
    name: "HPP & Margin",
    title: "HPP & Margin per kg Telur",
    ic: "percent",
    hue: "amber",
    description: "Biaya produksi dan margin per kg.",
    lead: "Perkiraan harga pokok per kg telur dari biaya pakan, dibanding harga jual hari ini.",
    formula: ["Biaya pakan per kg telur = Harga pakan × FCR", "HPP = Biaya pakan ÷ Porsi biaya pakan (%) × 100", "Margin = (Harga jual − HPP) ÷ Harga jual × 100"],
    fields: [
      { key: "feedPrice", label: "Harga pakan", unit: "Rp/kg", example: 7500 },
      { key: "fcr", label: "FCR", unit: "kg/kg", example: 2.2, hint: "Pakai kalkulator FCR bila belum tahu." },
      { key: "feedShare", label: "Porsi biaya pakan dari total biaya", unit: "%", example: 70, hint: "Umumnya 65–75% dari biaya produksi." },
      { key: "eggPrice", label: "Harga jual telur", unit: "Rp/kg", example: 26000 },
    ],
    compute: ({ feedPrice, fcr, feedShare, eggPrice }) => {
      if (!(feedPrice > 0 && fcr > 0 && feedShare > 0 && eggPrice > 0)) return null;
      if (feedShare > 100) return { invalid: "Porsi biaya pakan maksimal 100% dari total biaya." };
      const feedCost = feedPrice * fcr;
      const hpp = feedCost / (feedShare / 100);
      const margin = eggPrice - hpp;
      return {
        value: (margin / eggPrice) * 100,
        details: [["Biaya pakan per kg telur", rupiah(feedCost)], ["HPP per kg telur", rupiah(hpp)], ["Margin per kg", rupiah(margin)]],
        short: `HPP ${rupiah(hpp)}/kg`,
      };
    },
    format: (value) => formatNumber(value, 1),
    unit: "% margin",
    unitLong: "margin dari harga jual",
    module: /Ekonomi Farm/i,
    scale: {
      min: -20,
      max: 40,
      zones: [
        { upTo: 0, tone: "act", label: "Rugi", note: "HPP di atas harga jual; cek FCR, harga pakan, dan biaya lain." },
        { upTo: 10, tone: "watch", label: "Tipis", note: "Margin rentan terhadap kenaikan harga pakan atau turunnya harga telur." },
        { upTo: Infinity, tone: "good", label: "Sehat", note: "Ada ruang aman terhadap fluktuasi harga." },
      ],
    },
  },
  {
    id: "roi",
    name: "ROI & BEP",
    title: "ROI & Break Even Point",
    ic: "wallet",
    hue: "amber",
    description: "Kelayakan keputusan investasi.",
    lead: "Seberapa cepat investasi kembali dari margin kotor tahunan.",
    formula: ["Gross margin = Revenue − OPEX", "BEP = CAPEX ÷ Margin · ROI = Margin ÷ CAPEX × 100"],
    fields: [
      { key: "capex", label: "CAPEX", unit: "Rp", example: 500000000 },
      { key: "opex", label: "OPEX per tahun", unit: "Rp", example: 800000000 },
      { key: "revenue", label: "Revenue per tahun", unit: "Rp", example: 1100000000 },
    ],
    compute: ({ capex, opex, revenue }) => {
      if (!(capex > 0 && opex > 0 && revenue > 0)) return null;
      const margin = revenue - opex;
      const breakEven = margin > 0 ? `${formatNumber(capex / margin, 1)} tahun` : "Tidak tercapai";
      return {
        value: (margin / capex) * 100,
        details: [["Break even", breakEven], ["Gross margin", rupiah(margin)]],
        short: `BEP ${breakEven}`,
      };
    },
    format: (value) => formatNumber(value, 0),
    unit: "% ROI",
    unitLong: "ROI per tahun",
    module: /Break Even|ROI/i,
    scale: {
      min: -20,
      max: 60,
      zones: [
        { upTo: 0, tone: "act", label: "Belum profit", note: "Evaluasi OPEX dan revenue sebelum investasi." },
        { upTo: 20, tone: "watch", label: "Marginal", note: "Optimalkan biaya agar margin lebih aman." },
        { upTo: Infinity, tone: "good", label: "Layak", note: "Menguntungkan untuk dipertimbangkan." },
      ],
    },
  },
];

function parse(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const number = Number.parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function evaluate(tool, values) {
  const numbers = Object.fromEntries(tool.fields.map((field) => [field.key, parse(values[field.key])]));
  const missing = tool.fields
    .filter((field) => !field.optional)
    .filter((field) => {
      const number = numbers[field.key];
      return !Number.isFinite(number) || (field.allowZero ? number < 0 : number <= 0);
    })
    .map((field) => field.label);
  const outcome = missing.length ? null : tool.compute(numbers);
  // A tool can explain why the numbers cannot be right (more eggs than hens).
  if (outcome?.invalid) return { ready: false, missing: [], invalid: outcome.invalid };
  if (!outcome || !Number.isFinite(outcome.value)) return { ready: false, missing: missing.length ? missing : tool.fields.map((field) => field.label) };
  const zone = tool.scale?.zones.find((item) => outcome.value < item.upTo) || tool.scale?.zones[tool.scale.zones.length - 1];
  const tone = zone ? zone.tone : "info";
  return {
    ready: true,
    value: outcome.value,
    text: tool.format(outcome.value),
    verdict: zone?.label || "Perkiraan",
    note: zone?.note || outcome.note,
    details: outcome.details || [],
    short: outcome.short || "",
    tone,
  };
}

function appiPrompt(tool, values, reading) {
  const inputs = tool.fields
    .filter((field) => values[field.key] !== "" && values[field.key] !== undefined)
    .map((field) => `${field.label} ${values[field.key]} ${field.unit}`)
    .join(", ");
  return `Saya menghitung ${tool.title} di kalkulator Academy. Input: ${inputs}. Hasil: ${reading.text}${tool.unit ? ` ${tool.unit}` : ""} (${reading.verdict}). Apa artinya untuk flock saya dan apa yang perlu saya cek lebih dulu di kandang?`;
}

/** Zones of a reference scale with their ranges ("< 2,2", "2,2–2,6", "≥ 2,6"). */
function scaleZones(scale) {
  const span = scale.max - scale.min;
  let from = scale.min;
  return scale.zones.map((zone, index) => {
    const to = Math.min(zone.upTo, scale.max);
    const flex = Math.max(1, Math.round(((to - from) / span) * 16));
    const range = index === 0 ? `< ${decimal(zone.upTo)}` : zone.upTo === Infinity ? `≥ ${decimal(from)}` : `${decimal(from)}–${decimal(zone.upTo)}`;
    from = to;
    return { ...zone, flex, range };
  });
}

/** Where the result sits on the general reference (`.scale`), with icon, name and range per zone. */
function ReferenceScale({ scale, value, text, verdict, activeTone }) {
  const zones = scaleZones(scale);
  const position = Math.max(0, Math.min(100, ((value - scale.min) / (scale.max - scale.min)) * 100));
  const active = zones.find((zone) => zone.label === verdict);
  return (
    <div className="scale" role="img" aria-label={`Skala ${decimal(scale.min)} sampai ${decimal(scale.max)}. Nilai ${text} berada di zona ${verdict}${active ? `, ${active.range}` : ""}.`}>
      <div className="scale-track">
        {zones.map((zone) => <i key={zone.label} className={`zone-${zone.tone}`} style={{ flex: zone.flex }} />)}
        <span className="scale-marker" style={{ "--x": position.toFixed(1) }} />
      </div>
      <div className="row-start gap-0-5 t-caption t-muted" aria-hidden="true">
        {zones.map((zone) => {
          const on = zone.tone === activeTone && zone.label === verdict;
          return (
            <span key={zone.label} className={cn("stack items-center", on && "t-strong")} style={{ flex: zone.flex, minWidth: 0 }}>
              <span className={cn("row gap-1", on && TONE[zone.tone].text)}><Ic name={TONE[zone.tone].ic} size="xs" />{zone.label}</span>
              <span className="t-num">{zone.range}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CalcField({ field, value, onChange, flagged }) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const describedBy = flagged || field.hint ? hintId : undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        <span>{field.label}</span>
        {field.optional ? <span className="opt">opsional</span> : null}
      </label>
      <div className="input input-lg-sm" data-invalid={flagged ? "true" : undefined}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`contoh ${field.example.toLocaleString("id-ID")}`}
          aria-invalid={flagged || undefined}
          aria-describedby={describedBy}
        />
        <span className="unit calc-unit">{field.unit}</span>
      </div>
      {flagged ? (
        <span id={hintId} className="hint hint-error"><Ic name="alert" size="xs" />{field.allowZero ? "Isi 0 atau lebih." : "Isi angka di atas 0."}</span>
      ) : field.hint ? (
        <span id={hintId} className="hint">{field.hint}</span>
      ) : null}
    </div>
  );
}

function CalcResult({ tool, values, reading, panelRef }) {
  const tone = TONE[reading.ready ? reading.tone : "info"];
  const hue = reading.ready ? tone.hue : tool.hue;
  const missingText = reading.invalid ? reading.invalid : reading.missing?.length
    ? `Isi ${reading.missing.slice(0, -1).join(", ")}${reading.missing.length > 1 ? " dan " : ""}${reading.missing[reading.missing.length - 1]} untuk melihat hasil.`
    : "";
  return (
    <section ref={panelRef} className="card card-tint card-pad stack gap-4" data-hue={hue} aria-labelledby="res-title">
      <div className="stack gap-1">
        <h3 className="t-overline t-ink" id="res-title">Hasil</h3>
        <div className="row-end wrap gap-2">
          <span className="t-metric-lg">{reading.ready ? <CountUp key={tool.id} value={reading.value} format={tool.format} duration={500} /> : "—"}</span>
          {reading.ready ? <span className="t-support t-muted" style={{ paddingBottom: "var(--s-1)" }}>{tool.unitLong}</span> : null}
        </div>
      </div>
      {reading.ready ? <span className={cn("verdict", tone.verdict)}><Ic name={tone.ic} />{reading.verdict}</span> : null}
      {reading.ready && tool.scale ? <ReferenceScale scale={tool.scale} value={reading.value} text={reading.text} verdict={reading.verdict} activeTone={reading.tone} /> : null}
      {reading.ready && reading.details.length ? (
        <>
          <div className="divider" />
          <dl className="dl">
            {reading.details.map(([label, detail]) => (
              <React.Fragment key={label}><dt>{label}</dt><dd>{detail}</dd></React.Fragment>
            ))}
          </dl>
        </>
      ) : null}
      <div className="appi-says">
        <div className="appi-stage"><AppiMascot key={reading.ready ? reading.tone : "empty"} mood={reading.ready ? tone.mood : "curious"} size="lg" enter="pop" presence /></div>
        <p className="bubble tail-left grow appi-say"><span className="sr-only">APPI: </span>{reading.ready ? reading.note : missingText}</p>
      </div>
      {reading.ready ? (
        <button type="button" className="btn btn-ai-soft btn-block" onClick={() => askAppi(appiPrompt(tool, values, reading))}><Ic name="sparkle" />Tanya APPI soal hasil ini</button>
      ) : null}
      {tool.scale ? <p className="note">Acuan umum layer komersial; sesuaikan dengan standar strain dan umur flock.</p> : null}
    </section>
  );
}

/** "Terapkan di farm": the weekly reading in Farm KPI and the lesson behind the tool. */
function ApplyLinks({ tool, farmRows, modules }) {
  const sorted = sortByWeek(farmRows);
  const latest = tool.kpi ? [...sorted].reverse().find((row) => Number.isFinite(toNumber(row[tool.kpi.field]))) : null;
  const module = tool.module ? sortModules(modules).find((item) => tool.module.test(item.title)) : null;
  const level = getLevelForModule(module);
  return (
    <section className="card card-pad stack gap-4 anim-rise" style={{ "--i": 2 }} aria-labelledby="apply-title">
      <div className="stack gap-0-5">
        <h2 className="card-title" id="apply-title">Terapkan di farm</h2>
        <p className="card-desc">Satu angka belum cukup. Lihat polanya dari minggu ke minggu.</p>
      </div>
      <div className="grid-md">
        <Link className="card card-tactile row gap-3" to="/kpi" data-hue="orange" style={{ padding: "var(--s-3) var(--s-4)" }}>
          <span className="tile tile-round tile-solid"><Ic name="chart" /></span>
          <span className="stack grow" style={{ minWidth: 0 }}>
            <span className="li-title t-strong">{tool.kpi ? `Catat ${tool.kpi.label} mingguan di Farm KPI` : "Catat data mingguan di Farm KPI"}</span>
            <span className="li-meta">{latest ? `${tool.kpi.label} terakhir M${latest.week}: ${formatNumber(toNumber(latest[tool.kpi.field]), tool.kpi.digits)}${tool.kpi.suffix || ""}` : "Belum ada catatan minggu ini"}</span>
          </span>
          <Ic name="chev-right" className="t-muted" />
        </Link>
        {module ? (
          <Link className="card card-tactile row gap-3" to={`/modules/${module.moduleNumber}`} data-hue="blue" style={{ padding: "var(--s-3) var(--s-4)" }}>
            <span className="tile tile-round tile-solid"><Ic name="book" /></span>
            <span className="stack grow" style={{ minWidth: 0 }}>
              <span className="li-title t-strong t-clamp-2">Modul {moduleNo(module)} · {module.title}</span>
              <span className="li-meta">{level ? `Chapter ${level.number} · ${level.name}` : module.levelName}</span>
            </span>
            <Ic name="chev-right" className="t-muted" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Calculator workspace (canvas "Kalkulator farm"): pick a tool, enter actual
 * numbers and read the result on a reference scale while APPI explains it.
 * Values stay per tool while the learner switches between tools; on phones
 * the result is pinned above the bottom navigation.
 */
export default function Calculators() {
  const [active, setActive] = useState("fcr");
  const [values, setValues] = useState({});
  const [simulationWeeks, setSimulationWeeks] = useState({});
  const [panelVisible, setPanelVisible] = useState(true);
  const panelRef = useRef(null);
  const { data: farmRows = [] } = useFarmData();
  const { data: modules = [] } = useModules();
  const tool = tools.find((item) => item.id === active) || tools[0];
  const toolValues = useMemo(() => values[tool.id] || {}, [values, tool.id]);
  const reading = evaluate(tool, toolValues);
  const tone = TONE[reading.ready ? reading.tone : "info"];

  const setField = (key, value) => setValues((current) => ({ ...current, [tool.id]: { ...(current[tool.id] || {}), [key]: value } }));
  const simulationWeek = simulationWeeks[tool.id] || 0;
  const fillExample = () => {
    setSimulationWeeks((current) => ({ ...current, [tool.id]: 0 }));
    setValues((current) => ({ ...current, [tool.id]: Object.fromEntries(tool.fields.map((field) => [field.key, String(field.example)])) }));
  };
  // Each press is the next week, so the result and its verdict move without typing.
  const simulate = () => {
    const week = simulationWeek + 1;
    setSimulationWeeks((current) => ({ ...current, [tool.id]: week }));
    setValues((current) => ({ ...current, [tool.id]: simulateToolValues(tool.fields, week) }));
  };
  const reset = () => {
    setSimulationWeeks((current) => ({ ...current, [tool.id]: 0 }));
    setValues((current) => ({ ...current, [tool.id]: {} }));
  };
  const hasInput = Object.values(toolValues).some((value) => value !== "");

  // Phones: when the result card scrolls out of view, the dock keeps it in sight.
  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [tool.id]);

  return (
    <Page>
      <header className="ph">
        <div className="ph-copy">
          <h1 className="ph-title">Kalkulator farm</h1>
          <p className="ph-desc">Ubah catatan harian menjadi sinyal keputusan. Hasil adalah titik awal untuk observasi kandang, bukan penggantinya.</p>
        </div>
      </header>

      {/* Farm KPI lives beside the calculators: on phones the Alat tab is the only path to it. */}
      <Link className="card card-tactile row gap-3 calc-kpi-link" to="/kpi" data-hue="teal">
        <span className="tile tile-sm" aria-hidden="true"><Ic name="chart" /></span>
        <span className="stack grow gap-0-5" style={{ minWidth: 0 }}>
          <span className="t-strong">Farm KPI</span>
          <span className="t-caption t-muted">Catat data mingguan untuk dibaca bersama kalkulator.</span>
        </span>
        <Ic name="chev-right" className="t-muted" />
      </Link>

      <div className="scroll-x calc-pills" aria-label="Pilih kalkulator">
        <div className="row gap-2" role="group" aria-label="Pilih kalkulator" style={{ width: "max-content" }}>
          {tools.map((item) => (
            <button key={item.id} type="button" className={cn("btn calc-pill", active === item.id ? "btn-soft" : "btn-secondary")} aria-pressed={active === item.id} data-hue={item.hue} onClick={() => setActive(item.id)}>
              {active === item.id ? <Ic name="check" /> : <i className="tile tile-round tile-solid" style={{ width: 10, height: 10 }} aria-hidden="true" />}
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="split-rail">
        <section className="card anim-rise calc-rail" aria-labelledby="tools-title">
          <div className="card-pad stack gap-0-5" style={{ paddingBottom: "var(--s-3)" }}>
            <h2 className="card-title" id="tools-title">{tools.length} kalkulator</h2>
            <p className="card-desc">Pilih sesuai keputusan yang ingin Anda ambil.</p>
          </div>
          <div className="grid-sm" role="group" aria-label="Pilih kalkulator" style={{ gap: "var(--s-2)", padding: "0 var(--s-2) var(--s-3)" }}>
            {tools.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn("card card-tactile row gap-3", active === item.id && "card-tint card-selected")}
                aria-pressed={active === item.id}
                data-hue={item.hue}
                style={{ padding: "var(--s-2-5) var(--s-3)", textAlign: "left" }}
                onClick={() => setActive(item.id)}
              >
                <span className="tile tile-sm tile-round tile-solid"><Ic name={item.ic} /></span>
                <span className="stack grow" style={{ minWidth: 0 }}><span className="li-title t-strong">{item.name}</span><span className="li-meta">{item.description}</span></span>
              </button>
            ))}
          </div>
        </section>

        <div className="stack gap-grid">
          <section className="card anim-rise" key={tool.id} data-hue={tool.hue} style={{ "--i": 1 }} aria-labelledby="calc-title">
            <div className="card-pad card-head wrap">
              <div className="row-start gap-4" style={{ flex: "1 1 360px", minWidth: 0 }}>
                <span className="tile tile-lg"><Ic name={tool.ic} /></span>
                <div className="stack gap-0-5 grow">
                  <h2 className="t-title-c" id="calc-title">{tool.title}</h2>
                  <p className="card-desc">{tool.lead}</p>
                </div>
              </div>
              <div className="row wrap gap-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={fillExample}><Ic name="wand" />Isi contoh</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={simulate}><Ic name="chart" />{simulationWeek ? `Simulasi minggu ${simulationWeek}` : "Simulasi"}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!hasInput} onClick={reset}><Ic name="refresh" />Reset</button>
              </div>
            </div>

            <div className="card-sect card-pad split stretch">
              <form className="stack gap-4" aria-label={`Data ${tool.name}`} onSubmit={(event) => event.preventDefault()}>
                {tool.fields.map((field) => (
                  <CalcField
                    key={field.key}
                    field={field}
                    value={toolValues[field.key] ?? ""}
                    onChange={(value) => setField(field.key, value)}
                    flagged={!reading.ready && hasInput && reading.missing.includes(field.label) && toolValues[field.key] !== undefined && toolValues[field.key] !== ""}
                  />
                ))}
                <details className="inset card-pad-sm mt-auto calc-formula" open>
                  <summary className="row gap-2 t-support t-medium"><Ic name="chev-down" size="sm" />Lihat rumus</summary>
                  <div className="stack gap-1" style={{ padding: "var(--s-2) 0 var(--s-1) var(--s-6)" }}>
                    {tool.formula.map((line) => <code key={line} className="t-mono">{line}</code>)}
                  </div>
                </details>
              </form>
              <CalcResult tool={tool} values={toolValues} reading={reading} panelRef={panelRef} />
            </div>
          </section>

          <ApplyLinks tool={tool} farmRows={farmRows} modules={modules} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{reading.ready ? `${tool.name}: ${reading.text}${tool.unit ? ` ${tool.unit}` : ""}, ${reading.verdict}.` : ""}</p>
      {reading.ready && !panelVisible ? (
        <section className="card card-tint card-raised row gap-3 calc-dock anim-rise" data-hue={tone.hue} aria-label={`Hasil ${tool.name}`}>
          <div className="stack grow" style={{ minWidth: 0 }}>
            <span className="t-caption t-strong t-ink t-clamp-1">{tool.name}{reading.short ? ` · ${reading.short}` : ""}</span>
            <span className="t-metric">{reading.text}{tool.unit ? <small className="t-support t-muted"> {tool.unit}</small> : null}</span>
          </div>
          <span className={cn("verdict", tone.verdict)}><Ic name={tone.ic} />{reading.verdict}</span>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Lihat detail hasil" style={{ width: "var(--h-lg)", height: "var(--h-lg)" }} onClick={() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}><Ic name="chev-up" size="lg" /></button>
        </section>
      ) : null}
    </Page>
  );
}
