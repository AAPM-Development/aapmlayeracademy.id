import React, { useMemo, useState } from "react";
import { ConfirmDialog, DataTable, OverflowMenu, Sheet, SheetContent, SheetDescription, SheetTitle, StateView, useToast } from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";
import { Ic } from "@/design-system/canvas";
import { Sparkline } from "@/design-system/components/data";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";
import CanvasLineChart from "@/components/learn/CanvasChart";
import { askAppi } from "@/lib/askAppi";
import { formatMillion, formatNumber, KPI_METRICS, kpiPrompt, readingFor, sortByWeek, toNumber, weeklyReading } from "@/lib/kpiReading";
import { useFarmData, useSaveFarmData, useDeleteFarmData } from "@/lib/useCourseData";
import { cn } from "@/lib/utils";

/** @typedef {{key: string, direction: "asc" | "desc"}} DataTableSort */

const FARM_ENTRY_POINTS_LIMIT = 12;

function emptyForm() {
  return { week: "", henDayProduction: "", eggWeight: "", mortality: "", feedIntake: "", waterIntake: "", temperature: "", humidity: "", revenue: "", cost: "", notes: "" };
}

// The weekly entry sheet, grouped as on the canvas. `money` fields accept
// "50.400.000"; `max` bounds a percentage.
const GROUPS = [
  { id: "prod", title: "Produksi", ic: "egg", fields: [
    { key: "week", label: "Umur flock", unit: "minggu", required: true, integer: true },
    { key: "henDayProduction", label: "HDP", unit: "%", max: 100 },
    { key: "eggWeight", label: "Berat telur", unit: "g" },
    { key: "mortality", label: "Mortalitas", unit: "%", max: 100 },
  ] },
  { id: "feed", title: "Pakan & air", ic: "feed", fields: [
    { key: "feedIntake", label: "Asupan pakan", unit: "g/ekor/hari" },
    { key: "waterIntake", label: "Air minum", unit: "ml/ekor/hari" },
  ] },
  { id: "env", title: "Lingkungan", ic: "thermo", fields: [
    { key: "temperature", label: "Suhu", unit: "°C", placeholder: "Rata-rata harian", allowNegative: true },
    { key: "humidity", label: "Kelembapan", unit: "%", placeholder: "Rata-rata harian", max: 100 },
  ] },
  { id: "fin", title: "Keuangan", ic: "wallet", fields: [
    { key: "revenue", label: "Pendapatan", unit: "Rp", money: true },
    { key: "cost", label: "Biaya", unit: "Rp", money: true },
  ] },
];
const ALL_FIELDS = GROUPS.flatMap((group) => group.fields);

function parseField(field, value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalised = field.money ? text.replace(/[^\d-]/g, "") : text.replace(/\s/g, "").replace(",", ".");
  const number = Number.parseFloat(normalised);
  return Number.isFinite(number) ? number : NaN;
}

function fieldError(field, value) {
  const number = parseField(field, value);
  if (number === null) return field.required ? "Isi umur flock dalam minggu, misalnya 30." : null;
  if (Number.isNaN(number)) return "Isi dengan angka.";
  if (field.integer && (!Number.isInteger(number) || number < 1)) return "Isi minggu sebagai angka bulat, misalnya 30.";
  if (!field.allowNegative && number < 0) return "Isi 0 atau lebih.";
  if (field.max !== undefined && number > field.max) return `Isi angka 0–${field.max}.`;
  return null;
}

/** FCR from the week's own numbers: feed ÷ (HDP × egg weight). */
function computedFcr(form) {
  const feed = parseField({}, form.feedIntake);
  const hdp = parseField({}, form.henDayProduction);
  const egg = parseField({}, form.eggWeight);
  if (!(feed > 0 && hdp > 0 && hdp <= 100 && egg > 0)) return null;
  return feed / ((hdp / 100) * egg);
}

const formatCell = (value, digits = 1) => {
  const number = toNumber(value);
  return Number.isFinite(number) ? formatNumber(number, digits) : <span className="t-muted" aria-label="Tidak dicatat">—</span>;
};

function SheetField({ field, value, error, hint, onChange }) {
  const id = `farm-${field.key === "week" ? "week" : field.key}`;
  const describedBy = error || hint ? `${id}-h` : undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}><span>{field.label}{field.required ? <span className="req" aria-hidden="true"> *</span> : null}</span></label>
      <div className="input" data-invalid={error ? "true" : undefined}>
        <input
          id={id}
          type="text"
          inputMode={field.integer || field.money ? "numeric" : "decimal"}
          autoComplete="off"
          value={value}
          placeholder={field.placeholder}
          required={field.required || undefined}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="unit">{field.unit}</span>
      </div>
      {error ? <span className="hint hint-error" id={`${id}-h`}><Ic name="alert" size="xs" />{error}</span> : hint ? <span className="hint" id={`${id}-h`}>{hint}</span> : null}
    </div>
  );
}

const findingClass = { negative: "alert-warning", positive: "alert-success", neutral: "alert-info" };

/**
 * Farm KPI (canvas "Farm KPI"): APPI reads the latest week first, the
 * indicator tiles pick what the trend chart shows beside the week's context,
 * revenue and cost follow, and the weekly history sits below for edits. The
 * entry sheet groups the week by production, feed and water, environment and
 * finance; FCR is calculated from the week's own numbers.
 */
export default function KpiDashboard() {
  const { data: rows = [], isLoading, isError, refetch } = useFarmData();
  const save = useSaveFarmData();
  const del = useDeleteFarmData();
  const saveFarmData = /** @type {any} */ (save.mutateAsync);
  const deleteFarmData = /** @type {any} */ (del.mutateAsync);
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState("hdp");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [tableSort, setTableSort] = useState(/** @type {DataTableSort} */ ({ key: "week", direction: "desc" }));

  const sorted = useMemo(() => sortByWeek(rows), [rows]);
  const labels = useMemo(() => sorted.map((row) => `M${row.week}`), [sorted]);
  const reading = useMemo(() => weeklyReading(sorted), [sorted]);
  const tiles = useMemo(() => KPI_METRICS.map((metric) => ({ metric, ...readingFor(sorted, metric) })), [sorted]);
  const active = tiles.find((tile) => tile.metric.id === selected && tile.latest) || tiles.find((tile) => tile.latest) || tiles[0];
  const latestRow = sorted[sorted.length - 1] || null;
  const previousRow = sorted[sorted.length - 2] || null;
  const visibleRows = useMemo(() => {
    const direction = tableSort.direction === "asc" ? 1 : -1;
    return [...sorted].sort((a, b) => {
      const left = tableSort.key === "profit" ? toNumber(a.revenue) - toNumber(a.cost) : toNumber(a[tableSort.key]);
      const right = tableSort.key === "profit" ? toNumber(b.revenue) - toNumber(b.cost) : toNumber(b[tableSort.key]);
      if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
      if (!Number.isFinite(left)) return 1;
      if (!Number.isFinite(right)) return -1;
      return (left - right) * direction;
    });
  }, [sorted, tableSort]);

  const errors = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, fieldError(field, form[field.key])]).filter(([, error]) => error));
  const visibleErrors = touched ? errors : Object.fromEntries(Object.entries(errors).filter(([key]) => key !== "week"));
  const fcr = computedFcr(form);
  const reference = sorted.filter((row) => row.id !== editing?.id).slice(-1)[0] || null;

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) {
      const first = ALL_FIELDS.find((field) => errors[field.key]);
      document.getElementById(`farm-${first.key === "week" ? "week" : first.key}`)?.focus();
      return;
    }
    /** @type {Record<string, any>} */
    const data = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, parseField(field, form[field.key])]));
    data.notes = form.notes;
    data.fcr = fcr !== null ? Number(fcr.toFixed(2)) : editing?.fcr ?? null;
    try {
      await saveFarmData({ id: editing?.id ?? null, data });
      toast({ title: editing ? "Data diperbarui" : "Data farm ditambahkan", description: "Bacaan APPI sudah diperbarui." });
      setForm(emptyForm());
      setEditing(null);
      setTouched(false);
      setSheetOpen(false);
    } catch (error) {
      toast({ title: "Data belum tersimpan", description: error?.message || "Coba lagi dalam beberapa saat.", variant: "destructive" });
    }
  };

  const startEdit = (row) => {
    setEditing(row);
    setTouched(false);
    setForm(/** @type {ReturnType<typeof emptyForm>} */ (Object.fromEntries(Object.keys(emptyForm()).map((key) => {
      if (key === "notes") return [key, row.notes || ""];
      const value = row[key];
      if (value === null || value === undefined || value === "") return [key, ""];
      const field = ALL_FIELDS.find((item) => item.key === key);
      return [key, field?.money ? Math.round(Number(value)).toLocaleString("id-ID") : String(value).replace(".", ",")];
    }))));
    setSheetOpen(true);
  };

  const openNewEntry = () => {
    setEditing(null);
    setTouched(false);
    const nextWeek = latestRow ? String(Number(latestRow.week) + 1) : "";
    setForm({ ...emptyForm(), week: nextWeek });
    setSheetOpen(true);
  };

  const remove = async (id) => {
    try {
      await deleteFarmData(id);
      toast({ title: "Data dihapus" });
    } catch (error) {
      toast({ title: "Data belum dihapus", description: error?.message || "Coba lagi dalam beberapa saat.", variant: "destructive" });
    }
  };

  const hint = (key, digits = 1) => {
    if (!reference) return null;
    const value = toNumber(reference[key]);
    return Number.isFinite(value) ? `M${reference.week}: ${formatNumber(value, digits)}` : null;
  };

  const columns = [
    { key: "week", header: "Minggu", required: true, sortable: true, render: (row) => <span className="t-strong t-num">M{row.week}</span> },
    { key: "henDayProduction", header: "HDP (%)", align: "right", sortable: true, render: (row) => formatCell(row.henDayProduction) },
    { key: "fcr", header: "FCR", align: "right", sortable: true, render: (row) => formatCell(row.fcr, 2) },
    { key: "eggWeight", header: "Berat telur (g)", align: "right", sortable: true, render: (row) => formatCell(row.eggWeight) },
    { key: "feedIntake", header: "Pakan (g/ekor)", align: "right", sortable: true, render: (row) => formatCell(row.feedIntake, 0) },
    { key: "mortality", header: "Mortalitas (%)", align: "right", sortable: true, render: (row) => formatCell(row.mortality, 2) },
    { key: "profit", header: "Laba (Rp jt)", align: "right", sortable: true, render: (row) => { const value = toNumber(row.revenue) - toNumber(row.cost); return Number.isFinite(value) ? formatNumber(value / 1e6, 1) : <span className="t-muted" aria-label="Tidak dicatat">—</span>; } },
    { key: "temperature", header: "Suhu (°C)", align: "right", render: (row) => formatCell(row.temperature) },
    { key: "notes", header: "Catatan", render: (row) => (row.notes ? <span className="row gap-1 t-muted" title={row.notes}><Ic name="message" size="sm" /><span className="sr-only">{row.notes}</span></span> : <span className="t-muted" aria-label="Tidak dicatat">—</span>) },
    {
      key: "actions",
      header: <span className="sr-only">Aksi</span>,
      align: "end",
      required: true,
      render: (row) => (
        <div className="row gap-1 justify-end">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(row)}>Edit<span className="sr-only"> minggu {row.week}</span></button>
          <OverflowMenu label={`Aksi minggu ${row.week}`} items={[{ id: "delete", label: "Hapus data minggu ini", icon: "delete", tone: "danger", onSelect: () => setPendingDelete(row) }]} />
        </div>
      ),
    },
  ];

  const hasData = sorted.length > 0;
  const weekRow = sorted.find((row) => row.week === reading.week) || latestRow;
  const profitNow = latestRow ? toNumber(latestRow.revenue) - toNumber(latestRow.cost) : NaN;
  const profitBefore = previousRow ? toNumber(previousRow.revenue) - toNumber(previousRow.cost) : NaN;
  const profitChange = Number.isFinite(profitNow) && Number.isFinite(profitBefore) ? profitNow - profitBefore : null;
  const financeReady = sorted.filter((row) => Number.isFinite(toNumber(row.revenue)) && Number.isFinite(toNumber(row.cost))).length >= 2;
  const errorCount = Object.keys(visibleErrors).length;
  const isNewEntry = !editing;
  const entryNumber = rows.length + 1;

  return (
    <Page>
      <header className="ph">
        <div className="ph-copy">
          <h1 className="ph-title">Farm KPI</h1>
          <p className="ph-desc">Catat indikator mingguan, baca polanya, lalu putuskan tindakan berikutnya.</p>
        </div>
        {hasData ? (
          <div className="ph-actions">
            <button type="button" className="btn btn-primary" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={openNewEntry}><Ic name="plus" />Catat minggu ini</button>
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <StateView kind="loading" title="Memuat data KPI…" description="Kami sedang menyiapkan ringkasan produksi Anda." />
      ) : isError ? (
        <StateView kind="error" title="Data KPI belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<button type="button" className="btn btn-secondary" onClick={() => refetch()}><Ic name="refresh" />Coba lagi</button>} />
      ) : !hasData ? (
        <section className="card card-pad-lg stack items-center t-center gap-4 peek-host anim-rise" aria-labelledby="kpi-empty-title">
          <div className="appi-stage"><AppiMascot mood="curious" size="xl" enter="peek" /></div>
          <h2 className="t-title-c" id="kpi-empty-title">Belum ada data mingguan</h2>
          <p className="t-body t-muted measure">Catat satu minggu data flock. APPI akan membaca tren HDP, FCR, dan biaya untuk Anda.</p>
          <button type="button" className="btn btn-learn btn-lg" onClick={openNewEntry}><Ic name="plus" />Catat data pertama</button>
        </section>
      ) : (
        <>
          <section className="card card-pad-lg row-start wrap gap-6 anim-rise" aria-labelledby="appi-read-title">
            <div className="appi-stage" style={{ paddingTop: "var(--s-1)" }}><AppiMascot mood={reading.mood} size="xl" enter="pop" /></div>
            <div className="stack gap-4" style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="row-start between wrap gap-3">
                <div className="stack gap-0-5">
                  <span className="t-overline t-ai">Bacaan APPI · Minggu {reading.week}</span>
                  <h2 className="t-title-c" id="appi-read-title">{reading.title}</h2>
                </div>
                <button type="button" className="btn btn-ai-soft btn-sm" onClick={() => askAppi(kpiPrompt(sorted, reading))}><Ic name="message" />Diskusikan dengan APPI</button>
              </div>
              <ul className="stack gap-2" aria-label={`Temuan minggu ${reading.week}`}>
                {reading.findings.map((item, index) => {
                  const metric = KPI_METRICS.find((entry) => entry.id === item.metric);
                  const priority = item.tone === "negative" && index === 0 && reading.concerns > 1;
                  return (
                    <li key={item.text} className={cn("alert", priority ? "alert-danger" : findingClass[item.tone] || "alert-info")} style={{ padding: "var(--s-2) var(--s-3)", alignItems: "center" }}>
                      <Ic name={metric?.icon || "info"} />
                      <span className="grow">{item.text}</span>
                      {item.tone === "negative" ? <span className={cn("chip", priority ? "chip-danger" : "chip-warning")}>{priority ? "Prioritas" : "Pantau"}</span> : item.tone === "positive" ? <span className="chip chip-success">Baik</span> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="note">Nilai terakhir dan perubahan lengkap ada di setiap indikator di bawah.</p>
            </div>
          </section>

          <section className="stack gap-3 anim-rise" style={{ "--i": 1 }} aria-label="Indikator mingguan">
            <div className="grid-xs" role="tablist" aria-label="Pilih indikator untuk grafik">
              {tiles.map((tile) => {
                const isActive = tile.metric.id === active.metric.id;
                const sentimentText = tile.sentiment === "positive" ? "membaik" : tile.sentiment === "negative" ? "memburuk" : "stabil";
                return (
                  <button
                    key={tile.metric.id}
                    type="button"
                    role="tab"
                    id={`kpi-tab-${tile.metric.id}`}
                    aria-selected={isActive}
                    aria-controls="trend-panel"
                    tabIndex={isActive ? 0 : -1}
                    disabled={!tile.latest}
                    className={cn("kpi-tile", isActive && "is-on")}
                    data-hue={tile.metric.hue}
                    onClick={() => setSelected(tile.metric.id)}
                    onKeyDown={(event) => {
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                      const tabs = Array.from(event.currentTarget.parentElement.querySelectorAll('button[role="tab"]:not(:disabled)'));
                      const index = tabs.indexOf(event.currentTarget);
                      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + tabs.length) % tabs.length;
                      event.preventDefault();
                      const nextTab = /** @type {HTMLButtonElement} */ (tabs[nextIndex]);
                      nextTab?.focus();
                      nextTab?.click();
                    }}
                  >
                    <span className="row between gap-2"><span className={cn("t-overline", isActive ? "t-ink" : "t-muted")}>{tile.metric.label}</span><Ic name={tile.metric.icon} size="sm" className="t-ink" /></span>
                    <span className="metric-value">{tile.latest ? <CountUp value={tile.latest.value} format={tile.metric.format} /> : "—"}</span>
                    <span className="stack gap-1 items-start">
                      {tile.change !== null ? (
                        <span className={cn("delta", tile.sentiment === "positive" ? "delta-good" : tile.sentiment === "negative" ? "delta-bad" : "delta-flat")}>
                          <Ic name={tile.change > 0 ? "arrow-up" : tile.change < 0 ? "arrow-down" : "minus"} />
                          {tile.change === 0 ? "stabil" : tile.metric.delta(tile.change)}
                          <span className="sr-only">, {tile.change > 0 ? "naik" : tile.change < 0 ? "turun" : "tetap"}, {sentimentText}</span>
                        </span>
                      ) : (
                        <span className="delta delta-flat">{tile.latest ? "catatan pertama" : "belum dicatat"}</span>
                      )}
                      {tile.latest ? <span className="t-caption t-muted">Terakhir M{tile.latest.week}</span> : null}
                    </span>
                    {tile.values.length > 1 ? <Sparkline values={tile.values} hue={tile.metric.hue} className="mt-auto" aria-hidden="true" /> : <span className="mt-auto" />}
                  </button>
                );
              })}
            </div>
            <p className="note">Nilai terakhir yang tercatat · perubahan dibanding minggu sebelumnya.</p>
          </section>

          <section className="card anim-rise" style={{ "--i": 2 }} role="tabpanel" id="trend-panel" aria-labelledby="trend-title" data-hue={active.metric.hue}>
            <div className="card-pad card-head" style={{ paddingBottom: 0 }}>
              <div className="stack gap-0-5">
                <h2 className="card-title" id="trend-title">Tren {active.metric.label}</h2>
                <p className="card-desc">{active.metric.long} per umur flock (minggu){active.metric.band ? ` · pita hijau: ${active.metric.band.label}` : ""}.</p>
              </div>
              {active.latest ? <span className="chip chip-lg chip-hue t-num">M{active.latest.week} {active.metric.format(active.latest.value)}</span> : null}
            </div>
            <div className="card-pad split">
              {active.values.length > 1 ? (
                <CanvasLineChart
                  key={active.metric.id}
                  labels={active.points.map((point) => `M${point.week}`)}
                  series={[{ values: active.values, hue: active.metric.hue }]}
                  band={active.metric.band}
                  format={(value) => (active.metric.id === "profit" ? formatNumber(value / 1e6, 0) : formatNumber(value, active.metric.id === "fcr" || active.metric.id === "mortality" ? 2 : 0))}
                  title={`Tren ${active.metric.label} minggu ${active.points[0].week} sampai ${active.points[active.points.length - 1].week}`}
                  description={active.points.map((point) => `M${point.week} ${active.metric.format(point.value)}`).join(", ")}
                />
              ) : (
                <div className="inset row justify-center items-center t-support t-muted" style={{ minHeight: 200, padding: "var(--s-6)" }}>Catat minimal dua minggu untuk melihat tren indikator ini.</div>
              )}
              <aside className="inset card-pad stack gap-4" aria-labelledby="ctx-title">
                <div className="stack gap-0-5">
                  <h3 className="t-heading" id="ctx-title">Konteks minggu ini</h3>
                  <p className="t-caption t-muted">Kondisi kandang yang dicatat bersama M{weekRow?.week}.</p>
                </div>
                <dl className="dl">
                  <dt className="row gap-2"><Ic name="thermo" size="sm" />Suhu</dt><dd>{Number.isFinite(toNumber(weekRow?.temperature)) ? `${formatNumber(toNumber(weekRow.temperature), 1)} °C` : "—"}</dd>
                  <dt className="row gap-2"><Ic name="percent" size="sm" />Kelembapan</dt><dd>{Number.isFinite(toNumber(weekRow?.humidity)) ? `${formatNumber(toNumber(weekRow.humidity), 0)}%` : "—"}</dd>
                  <dt className="row gap-2"><Ic name="drop" size="sm" />Air minum</dt><dd>{Number.isFinite(toNumber(weekRow?.waterIntake)) ? `${formatNumber(toNumber(weekRow.waterIntake), 0)} ml/ekor` : "—"}</dd>
                </dl>
                <div className="divider" />
                <div className="stack gap-1">
                  <span className="row gap-2 t-support t-muted"><Ic name="message" size="sm" />Catatan</span>
                  <p className="t-support">{weekRow?.notes || "Belum ada catatan untuk minggu ini."}</p>
                </div>
              </aside>
            </div>
          </section>

          {financeReady ? (
            <section className="card anim-rise" style={{ "--i": 3 }} aria-labelledby="fin-title" data-hue="blue">
              <div className="card-pad card-head wrap" style={{ paddingBottom: 0 }}>
                <div className="stack gap-0-5">
                  <h2 className="card-title" id="fin-title">Pendapatan vs biaya</h2>
                  <p className="card-desc">Dalam juta rupiah per minggu.</p>
                </div>
                <div className="row gap-4" style={{ paddingTop: "var(--s-1)" }}>
                  <span className="legend" data-hue="blue"><i />Pendapatan</span>
                  <span className="legend" data-hue="orange"><i />Biaya</span>
                </div>
              </div>
              <div className="card-pad split">
                <CanvasLineChart
                  labels={labels}
                  series={[
                    { values: sorted.map((row) => toNumber(row.revenue) / 1e6), hue: "blue" },
                    { values: sorted.map((row) => toNumber(row.cost) / 1e6), hue: "orange", secondary: true },
                  ]}
                  format={(value) => formatNumber(value, 0)}
                  title={`Pendapatan dan biaya mingguan, ${labels[0]} sampai ${labels[labels.length - 1]}`}
                  description={`Pendapatan: ${sorted.map((row) => formatNumber(toNumber(row.revenue) / 1e6, 1)).join("; ")} juta. Biaya: ${sorted.map((row) => formatNumber(toNumber(row.cost) / 1e6, 1)).join("; ")} juta.`}
                />
                <aside className="inset card-pad stack gap-4" aria-labelledby="fin-week">
                  <div className="stack gap-0-5">
                    <h3 className="t-heading" id="fin-week">Minggu {latestRow?.week}</h3>
                    <p className="t-caption t-muted">Selisih pendapatan dan biaya adalah laba.</p>
                  </div>
                  <dl className="dl">
                    <dt className="row gap-2"><span className="legend" data-hue="blue"><i /></span>Pendapatan</dt><dd>{Number.isFinite(toNumber(latestRow?.revenue)) ? formatMillion(toNumber(latestRow.revenue)) : "—"}</dd>
                    <dt className="row gap-2"><span className="legend" data-hue="orange"><i /></span>Biaya</dt><dd>{Number.isFinite(toNumber(latestRow?.cost)) ? formatMillion(toNumber(latestRow.cost)) : "—"}</dd>
                  </dl>
                  <div className="divider" />
                  <div className="row between gap-3">
                    <span className="t-support t-strong">Laba</span>
                    <span className="row gap-2">
                      {profitChange !== null && profitChange !== 0 ? <span className={cn("delta", profitChange > 0 ? "delta-good" : "delta-bad")}><Ic name={profitChange > 0 ? "arrow-up" : "arrow-down"} />{formatMillion(Math.abs(profitChange))}<span className="sr-only">, {profitChange > 0 ? "naik" : "turun"}</span></span> : null}
                      <span className="t-heading t-num">{Number.isFinite(profitNow) ? formatMillion(profitNow) : "—"}</span>
                    </span>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}

          <section className="stack gap-3 anim-rise" style={{ "--i": 4 }} aria-labelledby="hist-title">
            <div className="sh">
              <div className="row gap-3"><h2 className="sh-title" id="hist-title">Riwayat mingguan</h2><span className="chip">{rows.length} catatan</span></div>
            </div>
            <DataTable
              caption="Riwayat KPI mingguan, minggu terbaru di atas"
              columns={columns}
              rows={visibleRows}
              rowKey={(row) => String(row.id)}
              responsive="stacked"
              emptyMessage="Belum ada data mingguan."
              sort={tableSort}
              onSort={(key) => setTableSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }))}
            />
          </section>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" hideClose aria-describedby="entry-desc">
          <div className="sheet-head">
            <div className="stack gap-2">
              <div className="stack gap-0-5">
                <span className="t-overline t-muted">Farm KPI · Minggu {form.week || "baru"}</span>
                <SheetTitle className="t-title-c">{editing ? `Edit data minggu ${editing.week}` : "Catat data mingguan"}</SheetTitle>
                <SheetDescription id="entry-desc" className="card-desc">{editing ? "Perbarui angka lalu simpan perubahan." : "Isi yang Anda punya; field lain boleh kosong."}</SheetDescription>
              </div>
              {isNewEntry && entryNumber <= FARM_ENTRY_POINTS_LIMIT ? <span className="chip chip-gold" style={{ alignSelf: "flex-start" }}><Ic name="star" />+10 poin · catatan ke-{entryNumber} dari {FARM_ENTRY_POINTS_LIMIT}</span> : null}
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label="Tutup" onClick={() => setSheetOpen(false)}><Ic name="x" /></button>
          </div>
          <form className="sheet-body" id="kpi-entry" noValidate onSubmit={submit}>
            {GROUPS.map((group, index) => (
              <React.Fragment key={group.id}>
                {index ? <div className="divider" /> : null}
                <div className="stack gap-3" role="group" aria-labelledby={`grp-${group.id}`}>
                  <h3 className="t-overline t-muted row gap-2" id={`grp-${group.id}`}><Ic name={group.ic} size="sm" />{group.title}</h3>
                  <div className="cols-2">
                    {group.fields.map((field) => (
                      <SheetField
                        key={field.key}
                        field={field}
                        value={form[field.key]}
                        error={visibleErrors[field.key]}
                        hint={field.key === "week" || field.money ? null : hint(field.key, field.key === "mortality" ? 2 : 1)}
                        onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                      />
                    ))}
                    {group.id === "feed" ? (
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label className="label" htmlFor="farm-fcr"><span>FCR</span><span className="chip"><Ic name="calc" />dihitung otomatis</span></label>
                        <div className="input is-disabled"><input id="farm-fcr" type="text" value={fcr !== null ? formatNumber(fcr, 2) : editing?.fcr ? formatNumber(toNumber(editing.fcr), 2) : "—"} readOnly aria-describedby="farm-fcr-h" /></div>
                        <span className="hint" id="farm-fcr-h">Asupan pakan ÷ (HDP × berat telur).{fcr === null ? " Menunggu HDP, berat telur, dan asupan pakan yang valid." : ""}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </React.Fragment>
            ))}
            <div className="divider" />
            <div className="stack gap-3">
              <h3 className="t-overline t-muted row gap-2" id="grp-note"><Ic name="message" size="sm" />Catatan operasional</h3>
              <textarea className="textarea" id="farm-notes" rows={3} aria-labelledby="grp-note" placeholder="Contoh: perubahan pakan, cuaca, atau kondisi kandang." value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </form>
          <div className="sheet-foot">
            {errorCount ? <span className="row gap-1 t-caption t-danger grow" role="status"><Ic name="alert" size="xs" />{errorCount} isian perlu diperbaiki</span> : <span className="grow" />}
            <button type="button" className="btn btn-ghost" onClick={() => setSheetOpen(false)}>Batal</button>
            <button type="submit" form="kpi-entry" className="btn btn-primary" disabled={save.isPending} aria-busy={save.isPending || undefined}>{editing ? "Simpan perubahan" : "Simpan data"}</button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Hapus data minggu ${pendingDelete?.week ?? ""}?`}
        description="Catatan KPI mingguan ini akan dihapus dari akun Anda dan tidak lagi dihitung di grafik."
        confirmLabel="Hapus data"
        destructive
        onConfirm={() => {
          const row = pendingDelete;
          setPendingDelete(null);
          if (row) remove(row.id);
        }}
      />
    </Page>
  );
}
