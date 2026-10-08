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

/**
 * Declares a calculator's outcome: one primary number (`value`), its reading
 * (`note`, flagged `attention` when it asks for action) and secondary figures
 * (`details`, [label, value] pairs). Until `ready` (the required inputs are
 * filled), the card shows the neutral empty state instead of a verdict
 * computed from zeros.
 */
function CalcResult() {
  return null;
}

const emptyNote = "Hasil muncul saat angka yang diperlukan terisi. Periksa kolom kosong atau bernilai 0.";

function CalculatorCard({ title, formula, children }) {
  const tool = React.useContext(ToolContext);
  const items = React.Children.toArray(children);
  const outcome = items.find((child) => React.isValidElement(child) && child.type === CalcResult);
  const inputs = items.filter((child) => child !== outcome);
  const { ready = false, value, note, attention = false, details = [] } = outcome?.props || {};
  const resultHue = ready && attention ? "orange" : tool.hue;

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
        <aside className="aapm-calc__result" data-hue={resultHue} data-empty={ready ? undefined : "true"} aria-live="polite">
          <p className="aapm-text-overline m-0">Hasil</p>
          <p className="aapm-calc__value">{ready ? value : "—"}</p>
          {ready && note ? (
            <p className="aapm-calc__note"><AapmIcon name={resultHue === "orange" ? "warning" : "check"} />{note}</p>
          ) : !ready ? (
            <p className="aapm-calc__note">{emptyNote}</p>
          ) : null}
          {ready && details.length ? (
            <dl className="aapm-description-list aapm-calc__details">
              {details.map(([label, detail]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          ) : null}
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
  const ready = f > 0 && eggMassKg > 0;
  const fcr = ready ? f / eggMassKg : 0;
  return (
    <CalculatorCard
      title="Feed Conversion Ratio (FCR)"
      formula="FCR = Total Feed (kg) ÷ Egg Mass (kg), Egg Mass = Total Eggs × Egg Weight ÷ 1000"
    >
      <Field label="Total Konsumsi Pakan" value={feed} onChange={setFeed} unit="kg" placeholder="contoh 120" />
      <Field label="Jumlah Telur" value={eggs} onChange={setEggs} unit="butir" placeholder="contoh 850" />
      <Field label="Berat Rata-rata Telur" value={eggW} onChange={setEggW} unit="gram" placeholder="contoh 60" />
      <CalcResult
        ready={ready}
        value={fcr.toFixed(2)}
        note={fcr < 2.2 ? "Sangat baik — efisien" : fcr < 2.6 ? "Baik" : "Perlu evaluasi feed & produksi"}
        attention={fcr >= 2.6}
        details={[["Egg mass", `${eggMassKg.toFixed(1)} kg`]]}
      />
    </CalculatorCard>
  );
}

function EggMassCalc() {
  const [hdp, setHdp] = useState("");
  const [ew, setEw] = useState("");
  const h = parseFloat(hdp) || 0;
  const w = parseFloat(ew) || 0;
  const mass = (h * w) / 100;
  return (
    <CalculatorCard title="Egg Mass per Ekor per Hari" formula="Egg Mass = HDP(%) × Egg Weight(g) ÷ 100">
      <Field label="Hen Day Production" value={hdp} onChange={setHdp} unit="%" placeholder="contoh 90" />
      <Field label="Berat Telur" value={ew} onChange={setEw} unit="gram" placeholder="contoh 60" />
      <CalcResult
        ready={h > 0 && w > 0}
        value={`${mass.toFixed(1)} g/ekor/hari`}
        note={mass >= 57 ? "Excellent — di atas standar layer komersial" : mass >= 50 ? "Baik" : "Di bawah target — evaluasi produksi & berat telur"}
        attention={mass < 50}
      />
    </CalculatorCard>
  );
}

function UniformityCalc() {
  const [avg, setAvg] = useState("");
  const [within, setWithin] = useState("");
  const [total, setTotal] = useState("");
  const wi = parseFloat(within) || 0;
  const t = parseFloat(total) || 0;
  const u = t > 0 ? Math.round((wi / t) * 100) : 0;
  return (
    <CalculatorCard
      title="Uniformity (%)"
      formula="Uniformity = (Jumlah ayam dalam ±10% berat rata-rata ÷ Total ayam) × 100"
    >
      <Field label="Berat Rata-rata" value={avg} onChange={setAvg} unit="gram" placeholder="contoh 1500" />
      <Field label="Ayam dalam ±10%" value={within} onChange={setWithin} unit="ekor" placeholder="contoh 80" />
      <Field label="Total Ayam Ditimbang" value={total} onChange={setTotal} unit="ekor" placeholder="contoh 100" />
      <CalcResult
        ready={t > 0 && wi > 0}
        value={`${u}%`}
        note={u >= 85 ? "Excellent — uniformity tinggi" : u >= 75 ? "Baik" : "Rendah — perlu seleksi/culling"}
        attention={u < 75}
      />
    </CalculatorCard>
  );
}

function MortalityCalc() {
  const [dead, setDead] = useState("");
  const [start, setStart] = useState("");
  const d = parseFloat(dead) || 0;
  const s = parseFloat(start) || 0;
  const m = s > 0 ? (d / s) * 100 : 0;
  return (
    <CalculatorCard
      title="Mortality & Livability"
      formula="Mortality = (Jumlah Mati ÷ Populasi Awal) × 100  |  Livability = 100 − Mortality"
    >
      <Field label="Jumlah Ayam Mati" value={dead} onChange={setDead} unit="ekor" placeholder="contoh 15" />
      <Field label="Populasi Awal" value={start} onChange={setStart} unit="ekor" placeholder="contoh 5000" />
      {/* Zero deaths is a real answer, so only the population must be above 0. */}
      <CalcResult
        ready={s > 0 && dead !== ""}
        value={`${m.toFixed(2)}%`}
        note={m < 1 ? "Baik — di bawah ambang normal" : m < 5 ? "Pantau — sedang" : "Tinggi — investigasi penyebab"}
        attention={m >= 1}
        details={[["Livability", `${(100 - m).toFixed(1)}%`]]}
      />
    </CalculatorCard>
  );
}

function WaterFeedCalc() {
  const [water, setWater] = useState("");
  const [feed, setFeed] = useState("");
  const w = parseFloat(water) || 0;
  const f = parseFloat(feed) || 0;
  const r = f > 0 ? w / f : 0;
  return (
    <CalculatorCard title="Water/Feed Ratio" formula="Ratio = Water Intake (ml) ÷ Feed Intake (g)  — Normal: 1.8–2.2">
      <Field label="Konsumsi Air" value={water} onChange={setWater} unit="ml/ekor/hari" placeholder="contoh 220" />
      <Field label="Konsumsi Pakan" value={feed} onChange={setFeed} unit="g/ekor/hari" placeholder="contoh 115" />
      <CalcResult
        ready={w > 0 && f > 0}
        value={r.toFixed(2)}
        note={r >= 1.8 && r <= 2.2 ? "Normal" : r > 2.2 ? "Tinggi — cek suhu/stres/kualitas air" : "Rendah — cek akses air & kualitas"}
        attention={r < 1.8 || r > 2.2}
      />
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
  // Rule of thumb: minimum (cold) 0.014 and tunnel (hot) 0.07 m³/min per kg live weight; a 36″ fan moves ≈ 340 m³/min.
  const kg = b * (w / 1000);
  const minVent = kg * 0.014;
  const tunnelVent = kg * 0.07;
  const fansTunnel = Math.ceil(tunnelVent / 340);
  return (
    <CalculatorCard
      title="Kebutuhan Ventilasi & Jumlah Fan"
      formula="Min vent (m³/min) = berat total (kg) × 0.014 | Tunnel = × 0.07 | Fan 36″ ≈ 340 m³/min"
    >
      <Field label="Jumlah Ayam" value={birds} onChange={setBirds} unit="ekor" placeholder="contoh 5000" />
      <Field label="Berat Rata-rata" value={weight} onChange={setWeight} unit="gram" placeholder="contoh 1800" />
      <Field label="Suhu Lingkungan" value={temp} onChange={setTemp} unit="°C" placeholder="contoh 30" />
      <CalcResult
        ready={b > 0 && w > 0}
        value={`${fansTunnel} fan 36″`}
        note="Perkiraan; sesuaikan dengan static pressure & design kandang"
        details={[
          ["Berat total", `${kg.toFixed(0)} kg`],
          ["Ventilasi minimum", `${minVent.toFixed(1)} m³/min`],
          [t > 0 ? `Tunnel (${t}°C)` : "Tunnel", `${tunnelVent.toFixed(1)} m³/min`],
        ]}
      />
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
  const roi = c > 0 ? (margin / c) * 100 : 0;
  return (
    <CalculatorCard
      title="ROI & Break Even Point"
      formula="Gross Margin = Revenue − OPEX | BEP = CAPEX ÷ Margin | ROI = (Margin ÷ CAPEX) × 100"
    >
      <Field label="CAPEX" value={capex} onChange={setCapex} unit="Rp" placeholder="contoh 500000000" />
      <Field label="OPEX per Tahun" value={opexYr} onChange={setOpexYr} unit="Rp" placeholder="contoh 800000000" />
      <Field label="Revenue per Tahun" value={revYr} onChange={setRevYr} unit="Rp" placeholder="contoh 1100000000" />
      <CalcResult
        ready={c > 0 && o > 0 && r > 0}
        value={`ROI ${roi.toFixed(0)}%`}
        note={roi > 20 ? "Menguntungkan — layak investasi" : roi > 0 ? "Marginal — optimalkan biaya" : "Belum profit — evaluasi OPEX/revenue"}
        attention={roi <= 20}
        details={[
          ["Break even", margin > 0 ? `${(c / margin).toFixed(1)} tahun` : "Tidak tercapai"],
          ["Gross margin", `Rp ${margin.toLocaleString("id-ID")}`],
        ]}
      />
    </CalculatorCard>
  );
}
