import React, { useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Badge, IconTile, Surface } from "@/components/primitives";

const tools = [
  { id: "fcr", name: "FCR", icon: "solar:chart-square-bold-duotone", tone: "green", description: "Baca efisiensi pakan terhadap egg mass." },
  { id: "eggmass", name: "Egg Mass", icon: "solar:chart-2-bold-duotone", tone: "orange", description: "Ukur output telur per ekor per hari." },
  { id: "uniformity", name: "Uniformity", icon: "solar:ruler-bold-duotone", tone: "blue", description: "Lihat konsistensi bobot flock." },
  { id: "mortality", name: "Mortality", icon: "solar:graph-down-bold-duotone", tone: "orange", description: "Pantau kehilangan dan livability." },
  {
    id: "waterfeed",
    name: "Water/Feed Ratio",
    icon: "solar:waterdrops-bold-duotone",
    tone: "blue",
    description: "Deteksi perubahan konsumsi air dan pakan.",
  },
  { id: "ventilation", name: "Ventilasi", icon: "solar:wind-bold-duotone", tone: "green", description: "Terjemahkan volume kandang menjadi airflow." },
  { id: "roi", name: "ROI & Break Even", icon: "solar:money-bag-bold-duotone", tone: "violet", description: "Uji kelayakan keputusan investasi farm." },
];

export default function Calculators() {
  const [active, setActive] = useState("fcr");
  const activeTool = tools.find((tool) => tool.id === active) || tools[0];

  return (
    <ContentContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Alat farm"
        title="Kalkulator interaktif"
        description="Ubah catatan harian menjadi sinyal keputusan yang bisa langsung dibaca tim farm."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
            <AapmIcon
              name="solar:calculator-bold-duotone"
              className="h-3.5 w-3.5 text-brand-orange"
            />{" "}
            7 kalkulator
          </div>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
        <Surface tone="orange" className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[16px] border-brand-orange/10" />
          <div className="relative">
            <Badge variant="soft" className="bg-background/80 text-[10px] uppercase tracking-[0.14em] text-tint-orange-foreground">Alat keputusan</Badge>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Hitung sebelum mengambil keputusan.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Mulai dari angka yang paling mudah Anda catat. Hasilnya bukan pengganti observasi kandang—tetapi titik awal untuk bertanya dengan lebih tepat.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {["Masukkan data", "Baca rumus", "Tentukan tindak lanjut"].map((step, index) => <div key={step} className="rounded-xl border border-tint-orange-border bg-background/70 p-3"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-[11px] font-bold text-white">{index + 1}</div><div className="mt-2 text-xs font-semibold text-foreground">{step}</div></div>)}
            </div>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start gap-3"><IconTile icon={activeTool.icon} tone={activeTool.tone} size="lg" /><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Alat aktif</div><h2 className="mt-1 text-lg font-semibold">{activeTool.name}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{activeTool.description}</p></div></div>
          <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Tip:</span> gunakan periode pengukuran yang sama agar hasil antarminggu tetap bisa dibandingkan.</div>
        </Surface>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <Surface className="min-w-0 p-3 lg:sticky lg:top-5 lg:self-start">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pilih alat</div>
          <div className="aapm-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {tools.map((tool) => <button key={tool.id} type="button" onClick={() => setActive(tool.id)} className={`group flex min-w-[11.5rem] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors lg:min-w-0 lg:w-full ${active === tool.id ? "border-brand-orange/45 bg-tint-orange text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-subtle hover:text-foreground"}`}><IconTile icon={tool.icon} tone={active === tool.id ? tool.tone : "neutral"} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{tool.name}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{tool.description}</span></span><AapmIcon name="chevronRight" className={`h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${active === tool.id ? "text-brand-orange" : "text-muted-foreground/50"}`} /></button>)}
          </div>
        </Surface>
        <div className="min-w-0">
          {active === "fcr" && <FcrCalc />}
          {active === "eggmass" && <EggMassCalc />}
          {active === "uniformity" && <UniformityCalc />}
          {active === "mortality" && <MortalityCalc />}
          {active === "waterfeed" && <WaterFeedCalc />}
          {active === "ventilation" && <VentilationCalc />}
          {active === "roi" && <RoiCalc />}
        </div>
      </section>
    </ContentContainer>
  );
}

function Card({ title, formula, children, result }) {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-[var(--card-radius)] border border-border bg-card p-5 shadow-[var(--surface-shadow)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-orange" />
      <div className="mb-4 flex items-start gap-3">
        <IconTile icon="solar:calculator-bold-duotone" tone="orange" size="md" />
        <div className="min-w-0"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">Masukkan angka aktual untuk mendapatkan indikator awal.</p></div>
      </div>
      {formula && (
        <div className="mb-4 min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-surface-subtle px-3 py-2.5 font-mono text-xs leading-5 text-muted-foreground whitespace-nowrap">
          {formula}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      {result !== undefined && result !== null && (
        <div className="mt-5 rounded-xl border border-tint-orange-border bg-tint-orange px-4 py-3">
          <div className="text-xs font-medium text-tint-orange-foreground">
            Hasil
          </div>
          <div className="mt-0.5 text-2xl font-bold text-tint-orange-foreground">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, unit, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="aapm-field mt-1 flex min-h-11 items-center rounded-xl border border-input bg-background px-3 transition-colors focus-within:border-brand-orange/55 focus-within:ring-2 focus-within:ring-brand-orange/10">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
        {unit && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
    </label>
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
    <Card
      title="Feed Conversion Ratio (FCR)"
      formula="FCR = Total Feed (kg) ÷ Egg Mass (kg), Egg Mass = Total Eggs × Egg Weight ÷ 1000"
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
    </Card>
  );
}

function EggMassCalc() {
  const [hdp, setHdp] = useState("");
  const [ew, setEw] = useState("");
  const h = parseFloat(hdp) || 0;
  const w = parseFloat(ew) || 0;
  const mass = ((h * w) / 100).toFixed(1);
  return (
    <Card
      title="Egg Mass per Ekor per Hari"
      formula="Egg Mass = HDP(%) × Egg Weight(g) ÷ 100"
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
    </Card>
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
    <Card
      title="Uniformity (%)"
      formula="Uniformity = (Jumlah ayam dalam ±10% berat rata-rata ÷ Total ayam) × 100"
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
    </Card>
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
    <Card
      title="Mortality & Livability"
      formula="Mortality = (Jumlah Mati ÷ Populasi Awal) × 100  |  Livability = 100 − Mortality"
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
    </Card>
  );
}

function WaterFeedCalc() {
  const [water, setWater] = useState("");
  const [feed, setFeed] = useState("");
  const w = parseFloat(water) || 0;
  const f = parseFloat(feed) || 0;
  const r = f > 0 ? (w / f).toFixed(2) : "—";
  return (
    <Card
      title="Water/Feed Ratio"
      formula="Ratio = Water Intake (ml) ÷ Feed Intake (g)  — Normal: 1.8–2.2"
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
    </Card>
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
    <Card
      title="Kebutuhan Ventilasi & Jumlah Fan"
      formula="Min vent (m³/min) = berat total (kg) × 0.014 | Tunnel = × 0.07 | Fan 36″ ≈ 340 m³/min"
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
    </Card>
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
    <Card
      title="ROI & Break Even Point"
      formula="Gross Margin = Revenue − OPEX | BEP = CAPEX ÷ Margin | ROI = (Margin ÷ CAPEX) × 100"
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
    </Card>
  );
}

function resultTag(value, note) {
  return (
    <div className="mt-5 rounded-xl border border-tint-orange-border bg-tint-orange px-4 py-3 sm:col-span-2">
      <div className="text-xs font-medium text-tint-orange-foreground">
        Hasil
      </div>
      <div className="mt-0.5 text-2xl font-bold text-tint-orange-foreground">
        {value}
      </div>
      {note && (
        <div className="mt-1 text-xs text-tint-orange-foreground/80">
          {note}
        </div>
      )}
    </div>
  );
}
