import React, { useMemo, useState } from "react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import { LineChart, TrendChart } from "@/design-system/charts";
import {
  ConfirmDialog,
  SectionHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StateView,
  OverflowMenu,
  Badge,
  Button,
  DataTable,
  FormGrid,
  Field,
  FormSection,
  Input,
  Label,
  Sparkline,
  Textarea,
} from "@/components/primitives";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";
import { askAppi } from "@/lib/askAppi";
import { useFarmData, useSaveFarmData, useDeleteFarmData } from "@/lib/useCourseData";
import { useToast } from "@/components/primitives";

/** @typedef {{key: string, header: string, [key: string]: any}} DataTableColumn */
/** @typedef {{key: string, direction: "asc" | "desc"}} DataTableSort */

function emptyForm() {
  return {
    week: "",
    henDayProduction: "",
    feedIntake: "",
    eggWeight: "",
    mortality: "",
    waterIntake: "",
    temperature: "",
    humidity: "",
    revenue: "",
    cost: "",
    fcr: "",
    notes: "",
  };
}

const numberFields = [
  { key: "week", label: "Umur (minggu)", required: true },
  { key: "henDayProduction", label: "HDP (%)" },
  { key: "feedIntake", label: "Asupan pakan (g)" },
  { key: "eggWeight", label: "Berat telur (g)" },
  { key: "fcr", label: "FCR" },
  { key: "mortality", label: "Mortalitas (%)" },
  { key: "waterIntake", label: "Air minum (ml)" },
  { key: "temperature", label: "Suhu (°C)" },
  { key: "humidity", label: "Kelembapan (%)" },
  { key: "revenue", label: "Pendapatan (Rp)" },
  { key: "cost", label: "Biaya (Rp)" },
];

const primaryFields = numberFields.slice(0, 5);
const contextFields = numberFields.slice(5);

const number = (value, digits = 1) => Number(value).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const million = (value) => `Rp ${number(value / 1e6, 1)} jt`;

/**
 * The indicators a farm reads every week. `better` says which direction is
 * good, so a change is coloured by meaning, not by sign. FCR carries the same
 * general reference band as the calculator.
 */
const METRICS = [
  { id: "hdp", label: "HDP", long: "Hen day production", hue: "orange", icon: "chart", better: "up", read: (row) => toNumber(row.henDayProduction), format: (value) => `${number(value, 1)}%`, delta: (value) => `${number(Math.abs(value), 1)} poin` },
  { id: "fcr", label: "FCR", long: "Feed conversion ratio", hue: "green", icon: "equalRatio", better: "down", read: (row) => toNumber(row.fcr), format: (value) => number(value, 2), delta: (value) => number(Math.abs(value), 2), band: { from: 1.6, to: 2.2, label: "acuan sangat baik ≤ 2,2" } },
  { id: "egg", label: "Berat telur", long: "Berat telur rata-rata", hue: "violet", icon: "egg", better: "up", read: (row) => toNumber(row.eggWeight), format: (value) => `${number(value, 1)} g`, delta: (value) => `${number(Math.abs(value), 1)} g` },
  { id: "mortality", label: "Mortalitas", long: "Mortalitas mingguan", hue: "rose", icon: "mortality", better: "down", read: (row) => toNumber(row.mortality), format: (value) => `${number(value, 2)}%`, delta: (value) => `${number(Math.abs(value), 2)} poin` },
  { id: "feed", label: "Pakan", long: "Asupan pakan per ekor", hue: "teal", icon: "feed", better: null, read: (row) => toNumber(row.feedIntake), format: (value) => `${number(value, 0)} g`, delta: (value) => `${number(Math.abs(value), 0)} g` },
  { id: "profit", label: "Laba", long: "Pendapatan dikurangi biaya", hue: "blue", icon: "finance", better: "up", read: (row) => toNumber(row.revenue) - toNumber(row.cost), format: million, delta: (value) => million(Math.abs(value)) },
];

/** Latest finite reading, the one before it, and the change between them. */
function readingFor(rows, metric) {
  const points = rows.map((row) => ({ week: row.week, value: metric.read(row) })).filter((point) => Number.isFinite(point.value));
  const latest = points[points.length - 1] || null;
  const previous = points[points.length - 2] || null;
  const change = latest && previous ? latest.value - previous.value : null;
  const sentiment = change === null || change === 0 || !metric.better ? "neutral" : (change > 0) === (metric.better === "up") ? "positive" : "negative";
  return { latest, previous, change, sentiment, values: points.map((point) => point.value) };
}

/** APPI's reading of the latest week: a mood, a headline and up to three findings. */
function weeklyReading(rows) {
  const week = rows.length ? rows[rows.length - 1].week : null;
  const readings = METRICS.map((metric) => ({ metric, ...readingFor(rows, metric) })).filter((item) => item.latest && item.latest.week === week);
  const comparable = readings.filter((item) => item.change !== null && item.metric.better);
  if (!readings.length) {
    return { week, mood: "data", title: "Data minggu ini belum lengkap", findings: [{ tone: "neutral", text: "Isi indikator minggu ini agar APPI bisa membacanya. Angka terakhir tetap tersedia di setiap indikator." }] };
  }
  if (!comparable.length) {
    return { week, mood: "data", title: "Belum cukup data untuk dibandingkan", findings: [{ tone: "neutral", text: "Catat indikator yang sama pada minggu berikutnya agar APPI bisa membaca arah perubahan." }] };
  }
  const relative = (item) => Math.abs(item.change / (item.previous.value || 1));
  const findings = [...comparable].sort((a, b) => relative(b) - relative(a)).slice(0, 3).map(({ metric, change, latest, sentiment }) => ({
    tone: sentiment,
    text: change === 0 ? `${metric.label} stabil di ${metric.format(latest.value)}.` : `${metric.label} ${change > 0 ? "naik" : "turun"} ${metric.delta(change)} menjadi ${metric.format(latest.value)}.`,
  }));
  const fcr = readings.find((item) => item.metric.id === "fcr");
  const fcrConcern = fcr && fcr.latest.value > 2.6;
  if (fcrConcern) findings.unshift({ tone: "negative", text: `FCR ${fcr.metric.format(fcr.latest.value)} di atas acuan 2,6. Cek pakan tercecer dan kualitas ransum.` });
  const negatives = comparable.filter((item) => item.sentiment === "negative").length + (fcrConcern && fcr.sentiment !== "negative" ? 1 : 0);
  const mood = negatives === 0 ? "happy" : negatives === 1 ? "think" : "concerned";
  const title = negatives === 0 ? "Minggu ini terlihat sehat" : negatives === 1 ? "Ada satu hal untuk dicek" : `${negatives} indikator perlu perhatian`;
  return { week, mood, title, findings: findings.slice(0, 3) };
}

function kpiPrompt(rows, reading) {
  const last = rows[rows.length - 1] || {};
  const parts = METRICS.map((metric) => {
    const value = metric.read(last);
    return Number.isFinite(value) ? `${metric.label} ${metric.format(value)}` : null;
  }).filter(Boolean).join(", ");
  return `Tolong baca KPI flock saya minggu ke-${reading.week}: ${parts}. ${reading.findings.map((item) => item.text).join(" ")} Apa tiga pemeriksaan prioritas di kandang minggu ini?`;
}

/**
 * Farm KPI: APPI reads the latest week first, the indicator tiles pick what
 * the one trend chart shows, and the weekly history sits below for edits.
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [selected, setSelected] = useState("hdp");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [tableSort, setTableSort] = useState(/** @type {DataTableSort} */ ({ key: "week", direction: "desc" }));

  const sorted = useMemo(() => [...rows].sort((a, b) => toNumber(a.week) - toNumber(b.week)), [rows]);
  const labels = useMemo(() => sorted.map((row) => `M${row.week}`), [sorted]);
  const reading = useMemo(() => weeklyReading(sorted), [sorted]);
  const tiles = useMemo(() => METRICS.map((metric) => ({ metric, ...readingFor(sorted, metric) })), [sorted]);
  const active = tiles.find((tile) => tile.metric.id === selected && tile.latest) || tiles.find((tile) => tile.latest) || tiles[0];
  const visibleWeeklyRows = useMemo(() => sortRows(sorted, tableSort), [sorted, tableSort]);
  const financeSeries = useMemo(() => {
    const revenue = sorted.map((row) => toNumber(row.revenue) / 1e6);
    const cost = sorted.map((row) => toNumber(row.cost) / 1e6);
    if (revenue.filter(Number.isFinite).length < 2 || cost.filter(Number.isFinite).length < 2) return [];
    return [
      { id: "revenue", label: "Pendapatan", values: revenue, hue: "blue" },
      { id: "cost", label: "Biaya", values: cost, hue: "orange" },
    ];
  }, [sorted]);

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.week ?? "").trim()) {
      setFieldErrors({ week: "Isi umur flock dalam minggu, misalnya 12." });
      document.getElementById("farm-week")?.focus();
      return;
    }
    setFieldErrors({});
    const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key === "notes" ? value : numeric(value)]));
    try {
      await saveFarmData({ id: editing?.id ?? null, data });
      toast({ title: editing ? "Data diperbarui" : "Data farm ditambahkan", description: "Bacaan APPI sudah diperbarui." });
      setForm(emptyForm());
      setEditing(null);
      setSheetOpen(false);
    } catch (error) {
      toast({ title: "Data belum tersimpan", description: error?.message || "Coba lagi dalam beberapa saat.", variant: "destructive" });
    }
  };

  const startEdit = (row) => {
    setEditing(row);
    setForm(/** @type {ReturnType<typeof emptyForm>} */ (Object.fromEntries(Object.keys(emptyForm()).map((key) => [key, key === "notes" ? row.notes || "" : row[key] ?? ""]))));
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

  const changeTableSort = (key) => {
    setTableSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  };

  const weeklyColumns = useMemo(
    /** @returns {DataTableColumn[]} */ () => [
      { key: "week", header: "Minggu", required: true, sortable: true, overflow: "nowrap", render: (row) => <span className="font-semibold tabular-nums">M{row.week}</span> },
      { key: "henDayProduction", header: "HDP", align: "right", sortable: true, overflow: "nowrap", render: (row) => formatValue(row.henDayProduction, "%") },
      { key: "fcr", header: "FCR", align: "right", sortable: true, overflow: "nowrap", render: (row) => formatValue(row.fcr) },
      { key: "feedIntake", header: "Pakan (g)", align: "right", sortable: true, overflow: "nowrap", render: (row) => formatValue(row.feedIntake) },
      { key: "eggWeight", header: "Telur (g)", align: "right", sortable: true, overflow: "nowrap", render: (row) => formatValue(row.eggWeight) },
      { key: "mortality", header: "Mortalitas", align: "right", sortable: true, overflow: "nowrap", render: (row) => formatValue(row.mortality, "%") },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        required: true,
        sticky: "right",
        overflow: "nowrap",
        render: (row) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => startEdit(row)}><AapmIcon name="edit" />Edit</Button>
            <OverflowMenu label={`Aksi minggu ${row.week}`} items={[{ id: "delete", label: "Hapus data minggu ini", icon: "delete", tone: "danger", onSelect: () => setPendingDelete(row) }]} />
          </div>
        ),
      },
    ],
    [],
  );

  const openNewEntry = () => {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const hasData = sorted.length > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Farm KPI"
        description="Catat indikator mingguan, baca polanya, lalu putuskan tindakan berikutnya."
        actions={hasData ? <Button type="button" onClick={openNewEntry}><AapmIcon name="plus" />Catat minggu ini</Button> : null}
      />

      {isLoading ? (
        <StateView kind="loading" title="Memuat data KPI…" description="Kami sedang menyiapkan ringkasan produksi Anda." />
      ) : isError ? (
        <StateView kind="error" title="Data KPI belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<Button variant="secondary" onClick={() => refetch()}>Coba lagi</Button>} />
      ) : !hasData ? (
        <section className="aapm-kpi-empty">
          <AppiMascot mood="data" size="xl" />
          <h2 className="aapm-kpi-empty__title">Belum ada data mingguan</h2>
          <p className="aapm-kpi-empty__text">Catat satu minggu data flock. APPI akan membaca tren HDP, FCR, dan biaya untuk Anda.</p>
          <Button type="button" variant="learn" size="lg" onClick={openNewEntry}><AapmIcon name="plus" />Catat data pertama</Button>
        </section>
      ) : (
        <>
          <section className="aapm-kpi-reading" aria-labelledby="kpi-reading-title">
            <AppiMascot mood={reading.mood} size={56} />
            <div className="aapm-kpi-reading__head">
              <div className="min-w-0">
                <p className="aapm-kpi-reading__eyebrow">Bacaan APPI · Minggu {reading.week}</p>
                <h2 id="kpi-reading-title" className="aapm-kpi-reading__title">{reading.title}</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={() => askAppi(kpiPrompt(sorted, reading))}>
                <AapmIcon name="ai" />Diskusikan dengan APPI
              </Button>
            </div>
            <ul className="aapm-kpi-reading__list">
              {reading.findings.map((item) => (
                <li key={item.text} data-tone={item.tone}>
                  <AapmIcon name={item.tone === "negative" ? "warning" : item.tone === "positive" ? "check" : "insight"} />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="aapm-kpi-board" aria-label="Indikator mingguan">
            <div className="aapm-kpi-tiles" role="tablist" aria-label="Pilih indikator untuk grafik">
              {tiles.map((tile) => {
                const isActive = tile.metric.id === active.metric.id;
                return (
                  <button
                    key={tile.metric.id}
                    type="button"
                    role="tab"
                    id={`kpi-tab-${tile.metric.id}`}
                    aria-selected={isActive}
                    aria-controls="kpi-trend-panel"
                    tabIndex={isActive ? 0 : -1}
                    disabled={!tile.latest}
                    className="aapm-kpi-tile"
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
                    <span className="aapm-kpi-tile__head">
                      <span className="aapm-kpi-tile__label">{tile.metric.label}</span>
                      <AapmIcon name={tile.metric.icon} />
                    </span>
                    <span className="aapm-kpi-tile__value">
                      {tile.latest ? <CountUp value={tile.latest.value} format={tile.metric.format} /> : "—"}
                    </span>
                    {tile.change !== null ? (
                      <span className="aapm-kpi-tile__delta" data-sentiment={tile.sentiment}>
                        <AapmIcon name={tile.change > 0 ? "arrowUp" : tile.change < 0 ? "arrowDown" : "glyphMinus"} />
                        {tile.change === 0 ? "stabil" : tile.metric.delta(tile.change)}
                      </span>
                    ) : (
                      <span className="aapm-kpi-tile__delta">{tile.latest ? "catatan pertama" : "belum dicatat"}</span>
                    )}
                    {tile.latest && tile.latest.week !== reading.week ? <span className="aapm-meta">Terakhir M{tile.latest.week}</span> : null}
                    {tile.values.length > 1 ? <Sparkline values={tile.values} hue={tile.metric.hue} height={28} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <p className="aapm-kpi-board__note">Nilai terakhir yang tercatat · perubahan dibanding catatan sebelumnya. Pilih indikator untuk melihat trennya.</p>

            <section id="kpi-trend-panel" role="tabpanel" aria-labelledby={`kpi-tab-${active.metric.id}`} className="aapm-card aapm-kpi-chart aapm-kpi-chart--trend" data-hue={active.metric.hue}>
              <header className="aapm-kpi-chart__head">
                <div className="min-w-0">
                  <h3 className="aapm-kpi-chart__title">Tren {active.metric.label}</h3>
                  <p className="aapm-kpi-chart__text">{active.metric.long} per umur flock{active.metric.band ? ` · pita hijau: ${active.metric.band.label}` : ""}.</p>
                </div>
                {active.latest ? <span className="aapm-kpi-chart__now"><span>M{active.latest.week}</span>{active.metric.format(active.latest.value)}</span> : null}
              </header>
              {active.values.length > 1 ? (
                <TrendChart
                  key={active.metric.id}
                  ariaLabel={`Grafik tren ${active.metric.label}`}
                  label={active.metric.label}
                  labels={labels}
                  values={sorted.map((row) => active.metric.read(row))}
                  hue={active.metric.hue}
                  band={active.metric.band}
                  valueFormatter={active.metric.format}
                  height={184}
                />
              ) : (
                <ChartEmpty message="Catat minimal dua minggu untuk melihat tren indikator ini." />
              )}
            </section>

            {financeSeries.length ? (
              <section className="aapm-card aapm-kpi-chart" aria-labelledby="kpi-finance-title">
                <header className="aapm-kpi-chart__head">
                  <div className="min-w-0">
                    <h3 id="kpi-finance-title" className="aapm-kpi-chart__title">Pendapatan vs biaya</h3>
                    <p className="aapm-kpi-chart__text">Dalam juta rupiah per minggu.</p>
                  </div>
                </header>
                <LineChart ariaLabel="Grafik pendapatan dan biaya" labels={labels} series={financeSeries} height={220} valueFormatter={(value) => `${number(value, 1)} jt`} />
              </section>
            ) : null}
          </section>

          <section aria-labelledby="weekly-history-title">
            <SectionHeader
              id="weekly-history-title"
              title="Riwayat mingguan"
              description="Data yang tersimpan di akun Anda. Edit untuk mengoreksi angka."
              actions={<Badge>{rows.length} catatan</Badge>}
            />
            <DataTable
              className="aapm-token-table"
              caption="Riwayat input KPI mingguan"
              columns={weeklyColumns}
              rows={visibleWeeklyRows}
              rowKey={(row) => String(row.id)}
              density="compact"
              responsive="stacked"
              emptyMessage="Belum ada data mingguan."
              sort={tableSort}
              onSort={changeTableSort}
            />
          </section>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="aapm-form-sheet">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit data minggu ${editing.week}` : "Catat data mingguan"}</SheetTitle>
            <SheetDescription>{editing ? "Perbarui angka lalu simpan perubahan." : "Isi yang Anda punya; field lain boleh kosong."}</SheetDescription>
          </SheetHeader>
          <div className="aapm-form-sheet__body">
            <form id="farm-data-form" noValidate onSubmit={submit} className="grid gap-5">
              <FormSection title="Produksi & efisiensi" description="Field inti untuk membaca performa flock." className="space-y-3">
                <FormGrid columns={2}>
                  {primaryFields.map((field) => (
                    <MetricInput
                      key={field.key}
                      fieldKey={field.key}
                      label={field.label}
                      value={form[field.key]}
                      required={field.required}
                      error={fieldErrors[field.key]}
                      onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                    />
                  ))}
                </FormGrid>
              </FormSection>

              <FormSection title="Konteks operasional" description="Suhu, input pakan, dan biaya membantu menjelaskan penyimpangan." className="space-y-3">
                <FormGrid columns={2}>
                  {contextFields.map((field) => (
                    <MetricInput
                      key={field.key}
                      fieldKey={field.key}
                      label={field.label}
                      value={form[field.key]}
                      required={field.required}
                      error={fieldErrors[field.key]}
                      onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                    />
                  ))}
                </FormGrid>
              </FormSection>

              <FormSection title="Catatan operasional" description="Simpan alasan perubahan, bukan sekadar angka." className="space-y-2">
                <Label htmlFor="farm-notes" className="sr-only">Catatan operasional</Label>
                <Textarea
                  id="farm-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Contoh: perubahan pakan, cuaca, atau kondisi kandang."
                />
              </FormSection>
            </form>
          </div>
          <SheetFooter className="aapm-form-sheet__footer">
            <Button type="button" variant="secondary" onClick={() => setSheetOpen(false)}>Batal</Button>
            <Button type="submit" form="farm-data-form" loading={save.isPending}>{editing ? "Simpan perubahan" : "Simpan data"}</Button>
          </SheetFooter>
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
    </ContentContainer>
  );
}

function MetricInput({ fieldKey, label, value, required = false, error, onChange }) {
  const id = fieldKey === "week" ? "farm-week" : `farm-${fieldKey}`;
  return (
    <Field id={id} label={label} required={required} error={error}>
      <Input type="number" inputMode="decimal" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function sortRows(rows, sort) {
  const factor = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = toNumber(a[sort.key]);
    const right = toNumber(b[sort.key]);
    if (Number.isFinite(left) && Number.isFinite(right)) return (left - right) * factor;
    return String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * factor;
  });
}

function ChartEmpty({ message }) {
  return <div className="aapm-kpi-chart__empty">{message}</div>;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numeric(value) {
  return value === "" || value === null || value === undefined ? null : parseFloat(value);
}

function formatValue(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "—" : `${String(value).replace(".", ",")}${suffix}`;
}
