import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, Button, IconTile, Input, PageHeader } from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";
import { askAppi } from "@/lib/askAppi";

const rupiah = (value) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

// Readings use the same general references across tools: "good" (green),
// "watch" (amber) and "act" (rose). They are starting points for a walk
// through the house, never a replacement for the strain standard.
const TONE = {
  good: { hue: "green", icon: "check", mood: "happy" },
  watch: { hue: "amber", icon: "warning", mood: "think" },
  act: { hue: "rose", icon: "warning", mood: "concerned" },
  info: { hue: "blue", icon: "insight", mood: "talk" },
};

/**
 * Each tool declares its inputs and a `compute` that returns null until the
 * required numbers are usable. `scale` places the result on a reference bar
 * whose zones also give the verdict; tools without a scale give an `info`
 * reading.
 */
const tools = [
  {
    id: "fcr",
    name: "FCR",
    title: "Feed Conversion Ratio (FCR)",
    icon: "equalRatio",
    hue: "green",
    description: "Efisiensi pakan terhadap egg mass.",
    formula: "FCR = Total pakan (kg) ÷ Egg mass (kg)\nEgg mass = Jumlah telur × Berat telur (g) ÷ 1000",
    fields: [
      { key: "feed", label: "Total konsumsi pakan", unit: "kg", example: 120 },
      { key: "eggs", label: "Jumlah telur", unit: "butir", example: 850 },
      { key: "eggWeight", label: "Berat rata-rata telur", unit: "gram", example: 60 },
    ],
    compute: ({ feed, eggs, eggWeight }) => {
      const eggMass = (eggs * eggWeight) / 1000;
      if (!(feed > 0 && eggMass > 0)) return null;
      return { value: feed / eggMass, details: [["Egg mass", `${eggMass.toFixed(1)} kg`]] };
    },
    format: (value) => value.toFixed(2),
    scale: {
      min: 1.6,
      max: 3.2,
      zones: [
        { upTo: 2.2, tone: "good", label: "Sangat baik", note: "Pakan terkonversi efisien menjadi telur." },
        { upTo: 2.6, tone: "watch", label: "Baik", note: "Masih wajar; pantau pakan tercecer dan berat telur." },
        { upTo: Infinity, tone: "act", label: "Evaluasi", note: "Cek pakan tercecer, kualitas ransum, dan produksi." },
      ],
    },
  },
  {
    id: "eggmass",
    name: "Egg Mass",
    title: "Egg Mass per Ekor per Hari",
    icon: "egg",
    hue: "orange",
    description: "Output telur per ekor per hari.",
    formula: "Egg mass = HDP (%) × Berat telur (g) ÷ 100",
    fields: [
      { key: "hdp", label: "Hen Day Production", unit: "%", example: 90 },
      { key: "eggWeight", label: "Berat telur", unit: "gram", example: 60 },
    ],
    compute: ({ hdp, eggWeight }) => (hdp > 0 && eggWeight > 0 ? { value: (hdp * eggWeight) / 100 } : null),
    format: (value) => value.toFixed(1),
    unit: "g/ekor/hari",
    scale: {
      min: 40,
      max: 66,
      zones: [
        { upTo: 50, tone: "act", label: "Di bawah target", note: "Evaluasi produksi dan berat telur bersama." },
        { upTo: 57, tone: "watch", label: "Baik", note: "Mendekati standar layer komersial." },
        { upTo: Infinity, tone: "good", label: "Excellent", note: "Di atas standar layer komersial." },
      ],
    },
  },
  {
    id: "uniformity",
    name: "Uniformity",
    title: "Uniformity (%)",
    icon: "weight",
    hue: "blue",
    description: "Konsistensi bobot flock.",
    formula: "Uniformity = Ayam dalam ±10% berat rata-rata ÷ Total ditimbang × 100",
    fields: [
      { key: "average", label: "Berat rata-rata", unit: "gram", example: 1500, optional: true },
      { key: "within", label: "Ayam dalam ±10%", unit: "ekor", example: 82 },
      { key: "total", label: "Total ayam ditimbang", unit: "ekor", example: 100 },
    ],
    compute: ({ within, total }) => (total > 0 && within > 0 ? { value: Math.min(100, (within / total) * 100) } : null),
    format: (value) => `${Math.round(value)}`,
    unit: "%",
    scale: {
      min: 50,
      max: 100,
      zones: [
        { upTo: 75, tone: "act", label: "Rendah", note: "Pertimbangkan grading, seleksi, atau culling." },
        { upTo: 85, tone: "watch", label: "Baik", note: "Jaga akses pakan dan kepadatan merata." },
        { upTo: Infinity, tone: "good", label: "Excellent", note: "Bobot flock seragam." },
      ],
    },
  },
  {
    id: "mortality",
    name: "Mortality",
    title: "Mortality & Livability",
    icon: "mortality",
    hue: "rose",
    description: "Kehilangan dan livability.",
    formula: "Mortality = Jumlah mati ÷ Populasi awal × 100\nLivability = 100 − Mortality",
    fields: [
      // Zero deaths is a real answer, so this field may be 0.
      { key: "dead", label: "Jumlah ayam mati", unit: "ekor", example: 15, allowZero: true },
      { key: "start", label: "Populasi awal", unit: "ekor", example: 5000 },
    ],
    compute: ({ dead, start }) => {
      if (!(start > 0) || !(dead >= 0)) return null;
      const mortality = (dead / start) * 100;
      return { value: mortality, details: [["Livability", `${(100 - mortality).toFixed(1)}%`]] };
    },
    format: (value) => value.toFixed(2),
    unit: "%",
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
    id: "waterfeed",
    name: "Water/Feed",
    title: "Water/Feed Ratio",
    icon: "waterRate",
    hue: "teal",
    description: "Perubahan konsumsi air dan pakan.",
    formula: "Rasio = Konsumsi air (ml) ÷ Konsumsi pakan (g) — normal 1,8–2,2",
    fields: [
      { key: "water", label: "Konsumsi air", unit: "ml/ekor", example: 220 },
      { key: "feed", label: "Konsumsi pakan", unit: "g/ekor", example: 115 },
    ],
    compute: ({ water, feed }) => (water > 0 && feed > 0 ? { value: water / feed } : null),
    format: (value) => value.toFixed(2),
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
    icon: "hvac",
    hue: "violet",
    description: "Volume kandang menjadi airflow.",
    formula: "Ventilasi minimum (m³/menit) = Berat total (kg) × 0,014\nTunnel = Berat total × 0,07 · Fan 36″ ≈ 340 m³/menit",
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
          ["Berat total", `${kg.toFixed(0)} kg`],
          ["Ventilasi minimum", `${(kg * 0.014).toFixed(1)} m³/menit`],
          [temp > 0 ? `Tunnel (${temp}°C)` : "Tunnel", `${tunnel.toFixed(1)} m³/menit`],
        ],
      };
    },
    format: (value) => `${Math.round(value)}`,
    unit: "fan 36″",
  },
  {
    id: "roi",
    name: "ROI & BEP",
    title: "ROI & Break Even Point",
    icon: "marginalRoi",
    hue: "amber",
    description: "Kelayakan keputusan investasi.",
    formula: "Gross margin = Revenue − OPEX · BEP = CAPEX ÷ Margin · ROI = Margin ÷ CAPEX × 100",
    fields: [
      { key: "capex", label: "CAPEX", unit: "Rp", example: 500000000 },
      { key: "opex", label: "OPEX per tahun", unit: "Rp", example: 800000000 },
      { key: "revenue", label: "Revenue per tahun", unit: "Rp", example: 1100000000 },
    ],
    compute: ({ capex, opex, revenue }) => {
      if (!(capex > 0 && opex > 0 && revenue > 0)) return null;
      const margin = revenue - opex;
      return {
        value: (margin / capex) * 100,
        details: [
          ["Break even", margin > 0 ? `${(capex / margin).toFixed(1)} tahun` : "Tidak tercapai"],
          ["Gross margin", rupiah(margin)],
        ],
      };
    },
    format: (value) => value.toFixed(0),
    unit: "% ROI",
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
  const number = Number.parseFloat(String(value).replace(",", "."));
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

/**
 * Calculator workspace: pick a tool, enter actual numbers, and read the result
 * on a reference bar while APPI explains it. Values stay per tool while the
 * learner switches between tools.
 */
export default function Calculators() {
  const [active, setActive] = useState("fcr");
  const [values, setValues] = useState({});
  const railRef = useScrollEdgeFade();
  const tool = tools.find((item) => item.id === active) || tools[0];
  const toolValues = values[tool.id] || {};
  const reading = evaluate(tool, toolValues);

  const setField = (key, value) => setValues((current) => ({ ...current, [tool.id]: { ...(current[tool.id] || {}), [key]: value } }));
  const fillExample = () => setValues((current) => ({ ...current, [tool.id]: Object.fromEntries(tool.fields.map((field) => [field.key, String(field.example)])) }));
  const reset = () => setValues((current) => ({ ...current, [tool.id]: {} }));
  const hasInput = Object.values(toolValues).some((value) => value !== "");

  return (
    <Page>
      <PageHeader
        title="Kalkulator farm"
        description="Ubah catatan harian menjadi sinyal keputusan. Hasil adalah titik awal untuk observasi kandang, bukan penggantinya."
        actions={<Badge size="lg" icon="calculator">{tools.length} kalkulator</Badge>}
      />
      <section className="aapm-calc-layout">
        <nav ref={railRef} className="aapm-calc-tools aapm-scroll-fade aapm-scroll-fade--x" aria-label="Pilih kalkulator">
          {tools.map((item) => (
            <button
              key={item.id}
              type="button"
              className="aapm-calc-tool"
              data-hue={item.hue}
              aria-pressed={active === item.id}
              onClick={() => setActive(item.id)}
            >
              <IconTile icon={item.icon} hue={item.hue} size="sm" shape="circle" variant={active === item.id ? "badge" : undefined} />
              <span className="min-w-0">
                <span className="aapm-calc-tool__name">{item.name}</span>
                <span className="aapm-calc-tool__description">{item.description}</span>
              </span>
            </button>
          ))}
        </nav>
        <article className="aapm-card aapm-calc" key={tool.id}>
          <header className="aapm-calc__header">
            <IconTile icon={tool.icon} hue={tool.hue} size="lg" shape="circle" />
            <div className="min-w-0 flex-1">
              <h2 className="aapm-text-section m-0">{tool.title}</h2>
              <p className="aapm-text-support m-0">{tool.description}</p>
            </div>
            <div className="aapm-calc__tools">
              <Button variant="ghost" size="sm" leadingIcon="star" onClick={fillExample}>Isi contoh</Button>
              {hasInput ? <Button variant="ghost" size="sm" leadingIcon="refresh" onClick={reset}>Reset</Button> : null}
            </div>
          </header>
          <details className="aapm-calc__formula">
            <summary><AapmIcon name="insight" />Lihat rumus</summary>
            <code>{tool.formula}</code>
          </details>
          <div className="aapm-calc__body">
            <div className="aapm-calc__inputs">
              {tool.fields.map((field) => (
                <CalcField
                  key={field.key}
                  field={field}
                  value={toolValues[field.key] ?? ""}
                  onChange={(value) => setField(field.key, value)}
                  flagged={!reading.ready && hasInput && reading.missing.includes(field.label) && toolValues[field.key] !== undefined && toolValues[field.key] !== ""}
                />
              ))}
            </div>
            <CalcResult tool={tool} values={toolValues} reading={reading} />
          </div>
        </article>
      </section>
    </Page>
  );
}

function CalcField({ field, value, onChange, flagged }) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  return (
    <div className="aapm-field">
      <label className="aapm-label" htmlFor={id}>
        {field.label}
        {field.optional ? <span className="aapm-calc__optional">opsional</span> : null}
      </label>
      <div className="aapm-input-group">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`contoh ${field.example.toLocaleString("id-ID")}`}
          className="pe-20"
          aria-invalid={flagged || undefined}
          aria-describedby={flagged ? hintId : undefined}
        />
        <span className="aapm-input-group__suffix aapm-calc__unit">{field.unit}</span>
      </div>
      {flagged ? <p id={hintId} className="aapm-calc__hint">{field.allowZero ? "Isi 0 atau lebih." : "Isi angka di atas 0."}</p> : null}
    </div>
  );
}

/** Where the result sits on the general reference, with the zone labels. */
function ReferenceBar({ scale, value, text, verdict }) {
  const span = scale.max - scale.min;
  const position = Math.max(0, Math.min(100, ((value - scale.min) / span) * 100));
  let from = scale.min;
  const zones = scale.zones.map((zone) => {
    const to = Math.min(zone.upTo, scale.max);
    const width = ((to - from) / span) * 100;
    from = to;
    return { ...zone, width };
  });
  return (
    <div className="aapm-calc-scale" role="img" aria-label={`Posisi ${text} pada acuan umum: ${verdict}`}>
      <div className="aapm-calc-scale__track">
        {zones.map((zone) => <span key={zone.label} className="aapm-calc-scale__zone" data-tone={zone.tone} style={{ width: `${zone.width}%` }} />)}
        <span className="aapm-calc-scale__marker" style={/** @type {React.CSSProperties} */ ({ "--position": position })}><i /></span>
      </div>
      <div className="aapm-calc-scale__labels" aria-hidden="true">
        {zones.map((zone) => <span key={zone.label} style={{ width: `${zone.width}%` }}>{zone.label}</span>)}
      </div>
    </div>
  );
}

function CalcResult({ tool, values, reading }) {
  const panelRef = useRef(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const tone = TONE[reading.ready ? reading.tone : "info"];
  const hue = reading.ready ? tone.hue : tool.hue;

  // Phones: when the result panel scrolls out of view, a slim bar keeps the
  // reading in sight above the bottom navigation.
  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const missingText = reading.missing?.length
    ? `Isi ${reading.missing.slice(0, -1).join(", ")}${reading.missing.length > 1 ? " dan " : ""}${reading.missing[reading.missing.length - 1]} untuk melihat hasil.`
    : "";

  return (
    <>
      <aside ref={panelRef} className="aapm-calc__result" data-hue={hue} data-empty={reading.ready ? undefined : "true"} aria-labelledby="calc-result-title">
        <p id="calc-result-title" className="aapm-text-overline m-0">Hasil</p>
        <p className="aapm-calc__value">
          {reading.ready ? <CountUp key={tool.id} value={reading.value} format={tool.format} duration={500} /> : "—"}
          {reading.ready && tool.unit ? <span className="aapm-calc__value-unit">{tool.unit}</span> : null}
        </p>
        {reading.ready ? (
          <span className="aapm-calc__verdict" data-tone={reading.tone}><AapmIcon name={tone.icon} />{reading.verdict}</span>
        ) : null}
        {reading.ready && tool.scale ? <ReferenceBar scale={tool.scale} value={reading.value} text={reading.text} verdict={reading.verdict} /> : null}
        {reading.ready && reading.details.length ? (
          <dl className="aapm-description-list aapm-calc__details">
            {reading.details.map(([label, detail]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="aapm-calc__appi">
          <AppiMascot mood={reading.ready ? tone.mood : "curious"} size={56} presence />
          <p className="aapm-calc__appi-text">{reading.ready ? reading.note : missingText}</p>
        </div>
        {reading.ready ? (
          <Button variant="secondary" size="sm" className="w-full" onClick={() => askAppi(appiPrompt(tool, values, reading))}>
            <AapmIcon name="ai" />Tanya APPI soal hasil ini
          </Button>
        ) : null}
        {tool.scale ? <p className="aapm-calc__source">Acuan umum layer komersial; sesuaikan dengan standar strain dan umur flock.</p> : null}
      </aside>
      <p className="aapm-visually-hidden" aria-live="polite">{reading.ready ? `${tool.name}: ${reading.text}${tool.unit ? ` ${tool.unit}` : ""}, ${reading.verdict}.` : ""}</p>
      {reading.ready && !panelVisible ? (
        <button type="button" className="aapm-calc-dock" data-hue={hue} onClick={() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <span className="aapm-calc-dock__label">{tool.name}</span>
          <strong className="aapm-calc-dock__value">{reading.text}{tool.unit ? ` ${tool.unit}` : ""}</strong>
          <span className="aapm-calc__verdict" data-tone={reading.tone}><AapmIcon name={tone.icon} />{reading.verdict}</span>
          <AapmIcon name="chevronDown" className="aapm-calc-dock__go" />
        </button>
      ) : null}
    </>
  );
}
