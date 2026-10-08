import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import React, { useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconTile, Input, PageHeader } from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";

const tools = [
  { id: "fcr", name: "FCR", icon: "equalRatio", hue: "green", description: "Efisiensi pakan terhadap egg mass." },
  { id: "eggmass", name: "Egg Mass", icon: "egg", hue: "orange", description: "Output telur per ekor per hari." },
  { id: "uniformity", name: "Uniformity", icon: "weight", hue: "blue", description: "Konsistensi bobot flock." },
  { id: "mortality", name: "Mortality", icon: "mortality", hue: "rose", description: "Kehilangan dan livability." },
  { id: "waterfeed", name: "Water/Feed Ratio", icon: "waterRate", hue: "teal", description: "Perubahan konsumsi air dan pakan." },
  { id: "ventilation", name: "Ventilasi", icon: "hvac", hue: "violet", description: "Volume kandang menjadi airflow." },
  { id: "roi", name: "ROI & Break Even", icon: "marginalRoi", hue: "amber", description: "Kelayakan keputusan investasi." },
];

const ToolContext = React.createContext(tools[0]);

/**
 * Calculator workspace (tool pattern): pick a tool, enter actual numbers on
 * the left, read the result and its interpretation on the right.
 */
export default function Calculators() {
  const [active, setActive] = useState("fcr");
  const railRef = useScrollEdgeFade();
  const activeTool = tools.find((tool) => tool.id === active) || tools[0];

  return (
    <Page>
      <PageHeader
        eyebrow="Alat farm"
        title="Kalkulator farm"
        description="Ubah catatan harian menjadi sinyal keputusan. Hasil adalah titik awal untuk observasi kandang, bukan penggantinya."
        actions={<Badge size="lg" icon="calculator">{tools.length} kalkulator</Badge>}
      />
      <section className="aapm-calc-layout">
        <nav ref={railRef} className="aapm-calc-tools aapm-scroll-fade aapm-scroll-fade--x" aria-label="Pilih kalkulator">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className="aapm-calc-tool"
              data-hue={tool.hue}
              aria-pressed={active === tool.id}
              onClick={() => setActive(tool.id)}
            >
              <IconTile icon={tool.icon} hue={tool.hue} size="sm" shape="circle" variant={active === tool.id ? "badge" : undefined} />
              <span className="min-w-0">
                <span className="aapm-calc-tool__name">{tool.name}</span>
                <span className="aapm-calc-tool__description">{tool.description}</span>
              </span>
            </button>
          ))}
        </nav>
        <ToolContext.Provider value={activeTool}>
          <div className="min-w-0" key={active}>
            {active === "fcr" && <FcrCalc />}
            {active === "eggmass" && <EggMassCalc />}
            {active === "uniformity" && <UniformityCalc />}
            {active === "mortality" && <MortalityCalc />}
            {active === "waterfeed" && <WaterFeedCalc />}
            {active === "ventilation" && <VentilationCalc />}
            {active === "roi" && <RoiCalc />}
          </div>
        </ToolContext.Provider>
      </section>
    </Page>
  );
}

function CalcResult() {
  return null;
}

const attentionPattern = /perlu|evaluasi|tinggi|risiko|rendah|kurang|waspada|cek|periksa|rugi|buruk/i;

function CalculatorCard({ title, formula, children, result }) {
  const tool = React.useContext(ToolContext);
  const items = React.Children.toArray(children);
  const outcome = items.find((child) => React.isValidElement(child) && child.type === CalcResult);
  const inputs = items.filter((child) => child !== outcome);
  const value = outcome ? outcome.props.value : result;
  const note = outcome?.props.note;
  const emptyNote = value === "—" ? "Hasil muncul saat semua angka terisi dan lebih dari 0. Periksa kolom kosong atau bernilai 0." : "Isi angka aktual untuk melihat interpretasi.";
  const resultHue = note && attentionPattern.test(String(note)) ? "orange" : tool.hue;

  return (
    <article className="aapm-card aapm-calc">
      <header className="aapm-calc__header">
        <IconTile icon={tool.icon} hue={tool.hue} size="lg" shape="circle" />
        <div className="min-w-0">
          <h2 className="aapm-text-section m-0">{title}</h2>
          <p className="aapm-text-support m-0">{tool.description}</p>
        </div>
      </header>
      {formula ? (
        <details className="aapm-calc__formula">
          <summary><AapmIcon name="insight" />Lihat rumus</summary>
          <code>{formula}</code>
        </details>
      ) : null}
      <div className="aapm-calc__body">
        <div className="aapm-calc__inputs">{inputs}</div>
        <aside className="aapm-calc__result" data-hue={resultHue} aria-live="polite">
          <p className="aapm-text-overline m-0">Hasil</p>
          <p className="aapm-calc__value">{value ?? "—"}</p>
          {note ? <p className="aapm-calc__note"><AapmIcon name={resultHue === "orange" ? "warning" : "check"} />{note}</p> : <p className="aapm-calc__note">{emptyNote}</p>}
        </aside>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, unit, placeholder }) {
  const id = React.useId();
  return (
    <div className="aapm-field">
      <label className="aapm-label" htmlFor={id}>{label}</label>
      <div className="aapm-input-group">
        <Input id={id} type="number" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={unit ? "pe-16" : undefined} />
        {unit ? <span className="aapm-input-group__suffix aapm-calc__unit">{unit}</span> : null}
      </div>
    </div>
  );
}

function FcrCalc() {
  const [feed, setFeed] = useState("");
  const [eggs, setEggs] = useState("");
  const [eggW, setEggW] = useState("");
  const f = parseFloat(feed) || 0;
  const e = parseFloat(eggs) || 0;
  const w = parseFloat(eggW) || 0;
  const eggMassKg = (e * w) / 1000;
  const fcr = eggMassKg > 0 ? (f / eggMassKg).toFixed(2) : "—";
  return (
    <CalculatorCard
      title="Feed Conversion Ratio (FCR)"
      formula="FCR = Total Feed (kg) ÷ Egg Mass (kg), Egg Mass = Total Eggs × Egg Weight ÷ 1000"
      icon="equalRatio"
      tone="green"
    >
      <Field
        label="Total Konsumsi Pakan"
        value={feed}
        onChange={setFeed}
        unit="kg"
        placeholder="contoh 120"
      />
      <Field
        label="Jumlah Telur"
        value={eggs}
        onChange={setEggs}
        unit="butir"
        placeholder="contoh 850"
      />
      <Field
        label="Berat Rata-rata Telur"
        value={eggW}
        onChange={setEggW}
        unit="gram"
        placeholder="contoh 60"
      />
      <div className="flex items-end">
        <div className="text-sm text-muted-foreground">
          Egg Mass:{" "}
          <span className="font-semibold text-foreground">
            {eggMassKg.toFixed(1)} kg
          </span>
        </div>
      </div>
      <div className="sm:col-span-2">
        FCR = {f} ÷ {eggMassKg.toFixed(1)} = {fcr}
      </div>
      {resultTag(
        fcr,
        fcr === "—"
          ? null
          : parseFloat(fcr) < 2.2
            ? "Sangat baik — efisien"
            : parseFloat(fcr) < 2.6
              ? "Baik"
              : "Perlu evaluasi feed & produksi",
      )}
    </CalculatorCard>
  );
}

function EggMassCalc() {
  const [hdp, setHdp] = useState("");
  const [ew, setEw] = useState("");
  const h = parseFloat(hdp) || 0;
  const w = parseFloat(ew) || 0;
  const mass = ((h * w) / 100).toFixed(1);
  return (
    <CalculatorCard
      title="Egg Mass per Ekor per Hari"
      formula="Egg Mass = HDP(%) × Egg Weight(g) ÷ 100"
      icon="egg"
      tone="orange"
    >
      <Field
        label="Hen Day Production"
        value={hdp}
        onChange={setHdp}
        unit="%"
        placeholder="contoh 90"
      />
      <Field
        label="Berat Telur"
        value={ew}
        onChange={setEw}
        unit="gram"
        placeholder="contoh 60"
      />
      {resultTag(
        `${mass} g/ekor/hari`,
        parseFloat(mass) >= 57
          ? "Excellent — di atas standar layer komersial"
          : parseFloat(mass) >= 50
            ? "Baik"
            : "Di bawah target — evaluasi produksi & berat telur",
      )}
    </CalculatorCard>
  );
}

function UniformityCalc() {
  const [avg, setAvg] = useState("");
  const [within, setWithin] = useState("");
  const [total, setTotal] = useState("");
  const a = parseFloat(avg) || 0;
  const wi = parseFloat(within) || 0;
  const t = parseFloat(total) || 0;
  const u = t > 0 ? Math.round((wi / t) * 100) : 0;
  return (
    <CalculatorCard
      title="Uniformity (%)"
      formula="Uniformity = (Jumlah ayam dalam ±10% berat rata-rata ÷ Total ayam) × 100"
      icon="weight"
      tone="lime"
    >
      <Field
        label="Berat Rata-rata"
        value={avg}
        onChange={setAvg}
        unit="gram"
        placeholder="contoh 1500"
      />
      <Field
        label="Ayam dalam ±10%"
        value={within}
        onChange={setWithin}
        unit="ekor"
        placeholder="contoh 80"
      />
      <Field
        label="Total Ayam Ditimbang"
        value={total}
        onChange={setTotal}
        unit="ekor"
        placeholder="contoh 100"
      />
      {resultTag(
        `${u}%`,
        u >= 85
          ? "Excellent — uniformity tinggi"
          : u >= 75
            ? "Baik"
            : "Rendah — perlu seleksi/culling",
      )}
    </CalculatorCard>
  );
}

function MortalityCalc() {
  const [dead, setDead] = useState("");
  const [start, setStart] = useState("");
  const d = parseFloat(dead) || 0;
  const s = parseFloat(start) || 0;
  const m = s > 0 ? ((d / s) * 100).toFixed(2) : "—";
  const liv = s > 0 ? (100 - parseFloat(m)).toFixed(1) : "—";
  return (
    <CalculatorCard
      title="Mortality & Livability"
      formula="Mortality = (Jumlah Mati ÷ Populasi Awal) × 100  |  Livability = 100 − Mortality"
      icon="mortality"
      tone="orange"
    >
      <Field
        label="Jumlah Ayam Mati"
        value={dead}
        onChange={setDead}
        unit="ekor"
        placeholder="contoh 15"
      />
      <Field
        label="Populasi Awal"
        value={start}
        onChange={setStart}
        unit="ekor"
        placeholder="contoh 5000"
      />
      {resultTag(
        `Mortality ${m}% · Livability ${liv}%`,
        parseFloat(m) < 1
          ? "Baik — di bawah ambang normal"
          : parseFloat(m) < 5
            ? "Pantau — sedang"
            : "Tinggi — investigasi penyebab",
      )}
    </CalculatorCard>
  );
}

function WaterFeedCalc() {
  const [water, setWater] = useState("");
  const [feed, setFeed] = useState("");
  const w = parseFloat(water) || 0;
  const f = parseFloat(feed) || 0;
  const r = f > 0 ? (w / f).toFixed(2) : "—";
  return (
    <CalculatorCard
      title="Water/Feed Ratio"
      formula="Ratio = Water Intake (ml) ÷ Feed Intake (g)  — Normal: 1.8–2.2"
      icon="waterRate"
      tone="lime"
    >
      <Field
        label="Konsumsi Air"
        value={water}
        onChange={setWater}
        unit="ml/ekor/hari"
        placeholder="contoh 220"
      />
      <Field
        label="Konsumsi Pakan"
        value={feed}
        onChange={setFeed}
        unit="g/ekor/hari"
        placeholder="contoh 115"
      />
      {resultTag(
        `${r}`,
        r === "—"
          ? null
          : parseFloat(r) >= 1.8 && parseFloat(r) <= 2.2
            ? "Normal"
            : parseFloat(r) > 2.2
              ? "Tinggi — cek suhu/stres/kualitas air"
              : "Rendah — cek akses air & kualitas",
      )}
    </CalculatorCard>
  );
}

function VentilationCalc() {
  const [birds, setBirds] = useState("");
  const [weight, setWeight] = useState("");
  const [temp, setTemp] = useState("");
  const b = parseFloat(birds) || 0;
  const w = parseFloat(weight) || 0;
  const t = parseFloat(temp) || 0;
  // Minimum ventilation: ~0.01 m3/kg/hr per bird per minute rule-of-thumb; tunnel ~ 1 m3/hr/kg hot
  // Simplified cfm: air needed m3/min = birds * weight(kg) * factor
  const kg = b * (w / 1000);
  const minVent = (kg * 0.014).toFixed(1); // m3/min minimum cold
  const tunnelVent = (kg * 0.07).toFixed(1); // m3/min hot tunnel
  const fanCapacity = 25000; // m3/hr typical fan -> convert
  // typical 36" fan ~ 340 m3/min
  const fansTunnel = tunnelVent > 0 ? Math.ceil(tunnelVent / 340) : 0;
  return (
    <CalculatorCard
      title="Kebutuhan Ventilasi & Jumlah Fan"
      formula="Min vent (m³/min) = berat total (kg) × 0.014 | Tunnel = × 0.07 | Fan 36″ ≈ 340 m³/min"
      icon="hvac"
      tone="green"
    >
      <Field
        label="Jumlah Ayam"
        value={birds}
        onChange={setBirds}
        unit="ekor"
        placeholder="contoh 5000"
      />
      <Field
        label="Berat Rata-rata"
        value={weight}
        onChange={setWeight}
        unit="gram"
        placeholder="contoh 1800"
      />
      <Field
        label="Suhu Lingkungan"
        value={temp}
        onChange={setTemp}
        unit="°C"
        placeholder="contoh 30"
      />
      <div className="sm:col-span-2 space-y-1.5 text-sm">
        <div>
          Berat total: <span className="font-semibold">{kg.toFixed(0)} kg</span>
        </div>
        <div>
          Minimum ventilation:{" "}
          <span className="font-semibold">{minVent} m³/min</span>
        </div>
        <div>
          Tunnel ventilation ({t}°C):{" "}
          <span className="font-semibold">{tunnelVent} m³/min</span>
        </div>
        <div>
          Estimasi fan 36″ (tunnel):{" "}
          <span className="font-semibold">{fansTunnel} unit</span>
        </div>
      </div>
      {resultTag(
        `${fansTunnel} fan 36″`,
        "Perkiraan; sesuaikan dengan static pressure & design kandang",
      )}
    </CalculatorCard>
  );
}

function RoiCalc() {
  const [capex, setCapex] = useState("");
  const [opexYr, setOpexYr] = useState("");
  const [revYr, setRevYr] = useState("");
  const c = parseFloat(capex) || 0;
  const o = parseFloat(opexYr) || 0;
  const r = parseFloat(revYr) || 0;
  const margin = r - o;
  const bep = margin > 0 ? (c / margin).toFixed(1) : "—";
  const roi = c > 0 && margin > 0 ? ((margin / c) * 100).toFixed(0) : "—";
  return (
    <CalculatorCard
      title="ROI & Break Even Point"
      formula="Gross Margin = Revenue − OPEX | BEP = CAPEX ÷ Margin | ROI = (Margin ÷ CAPEX) × 100"
      icon="marginalRoi"
      tone="orange"
    >
      <Field
        label="CAPEX"
        value={capex}
        onChange={setCapex}
        unit="Rp"
        placeholder="contoh 500000000"
      />
      <Field
        label="OPEX per Tahun"
        value={opexYr}
        onChange={setOpexYr}
        unit="Rp"
        placeholder="contoh 800000000"
      />
      <Field
        label="Revenue per Tahun"
        value={revYr}
        onChange={setRevYr}
        unit="Rp"
        placeholder="contoh 1100000000"
      />
      <div className="flex items-end">
        <div className="text-sm text-muted-foreground">
          Gross Margin:{" "}
          <span className="font-semibold text-foreground">
            Rp {margin.toLocaleString("id-ID")}
          </span>
        </div>
      </div>
      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">Break Even</div>
          <div className="font-bold">{bep} tahun</div>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">ROI</div>
          <div className="font-bold">{roi}%</div>
        </div>
      </div>
      {resultTag(
        `BEP ${bep} thn · ROI ${roi}%`,
        parseFloat(roi) > 20
          ? "Menguntungkan — layak investasi"
          : parseFloat(roi) > 0
            ? "Marginal — optimalkan biaya"
            : "Belum profit — evaluasi OPEX/revenue",
      )}
    </CalculatorCard>
  );
}

function resultTag(value, note) {
  return <CalcResult value={value} note={note} />;
}
