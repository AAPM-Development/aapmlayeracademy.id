import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import { LineChart as T7LineChart } from "@/design-system/charts";
import {
  Alert,
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
  Card,
  CardContent,
  ChartPanel,
  DataTable,
  FormGrid,
  Field,
  FormSection,
  IconTile,
  Input,
  KPICluster,
  Label,
  Sparkline,
  Textarea,
  TrendIndicator,
} from "@/components/primitives";
import { useFarmData, useSaveFarmData, useDeleteFarmData } from "@/lib/useCourseData";
import { useToast } from "@/components/primitives";
import {
  aggregateWismanByDate,
  WISMAN_FIXTURE_META,
  WISMAN_FIXTURE_ROWS,
} from "@/lib/wismanFixture";

/** @typedef {{label: string, value: any, [key: string]: any}} KPIItem */
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

export default function KpiDashboard() {
  const { data: rows = [], isLoading } = useFarmData();
  const save = useSaveFarmData();
  const del = useDeleteFarmData();
  const saveFarmData = /** @type {any} */ (save.mutateAsync);
  const deleteFarmData = /** @type {any} */ (del.mutateAsync);
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [fieldErrors, setFieldErrors] = useState({});
  // Keep the Wisman fixture available for explicit local QA without exposing
  // synthetic data or audit metadata in the learner-facing build.
  const devFixtureTools = import.meta.env.DEV;
  const [previewWisman, setPreviewWisman] = useState(() => {
    if (!devFixtureTools || typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("fixture") === "wisman";
  });
  const [tableSort, setTableSort] = useState(/** @type {DataTableSort} */ ({ key: "week", direction: "asc" }));

  const sorted = useMemo(
    () => [...rows].sort((a, b) => toNumber(a.week) - toNumber(b.week)),
    [rows],
  );
  const wismanRows = useMemo(() => aggregateWismanByDate(), []);
  const activeRows = previewWisman ? wismanRows : sorted;
  const activeSourceLabel = previewWisman
    ? "Wisman Farm · preview lokal"
    : "Farm API · data tersimpan";

  const activeLabels = useMemo(
    () =>
      activeRows.map((row) =>
        previewWisman ? formatDateLabel(row.date) : `M${row.week}`,
      ),
    [activeRows, previewWisman],
  );

  const activeStats = useMemo(
    () => buildStats(activeRows, { preview: previewWisman }),
    [activeRows, previewWisman],
  );

  const productionSeries = useMemo(() => {
    const hdp = completeSeries(activeRows, "henDayProduction");
    if (!hdp.length) return [];
    const series = [{ id: "hdp", label: "HDP (%)", values: hdp }];
    if (previewWisman) {
      const mortality = completeSeries(activeRows, "mortality");
      if (mortality.length) {
        series.push({ id: "mortality", label: "Mortalitas (%)", values: mortality });
      }
    }
    return series;
  }, [activeRows, previewWisman]);

  const fcrSeries = useMemo(
    () => (previewWisman ? [] : chartSeries(activeRows, "fcr", "FCR")),
    [activeRows, previewWisman],
  );

  const eggWeightSeries = useMemo(
    () => (previewWisman ? [] : chartSeries(activeRows, "eggWeight", "Berat telur (g)")),
    [activeRows, previewWisman],
  );

  const financeSeries = useMemo(() => {
    if (previewWisman) return [];
    const revenue = completeSeries(activeRows, "revenue");
    const cost = completeSeries(activeRows, "cost");
    if (!revenue.length || !cost.length) return [];
    return [
      { id: "revenue", label: "Pendapatan (jt)", values: revenue.map((value) => value / 1e6) },
      { id: "cost", label: "Biaya (jt)", values: cost.map((value) => value / 1e6) },
    ];
  }, [activeRows, previewWisman]);

  const visibleWeeklyRows = useMemo(
    () => sortRows(sorted, tableSort),
    [sorted, tableSort],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.week ?? "").trim()) {
      setFieldErrors({ week: "Isi umur flock dalam minggu, misalnya 12." });
      document.getElementById("farm-week")?.focus();
      return;
    }
    setFieldErrors({});
    const data = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        key === "notes" ? value : numeric(value),
      ]),
    );
    try {
      await saveFarmData({ id: editing?.id ?? null, data });
      toast({ title: editing ? "Data diperbarui" : "Data farm ditambahkan" });
      setForm(emptyForm());
      setEditing(null);
      setSheetOpen(false);
    } catch (error) {
      toast({
        title: "Data belum tersimpan",
        description: error?.message || "Coba lagi dalam beberapa saat.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (row) => {
    setEditing(row);
    setForm({
      week: row.week,
      henDayProduction: row.henDayProduction,
      feedIntake: row.feedIntake,
      eggWeight: row.eggWeight,
      mortality: row.mortality,
      waterIntake: row.waterIntake,
      temperature: row.temperature,
      humidity: row.humidity,
      revenue: row.revenue,
      cost: row.cost,
      fcr: row.fcr,
      notes: row.notes || "",
    });
    setSheetOpen(true);
  };

  const [pendingDelete, setPendingDelete] = useState(null);
  const remove = async (id) => {
    try {
      await deleteFarmData(id);
      toast({ title: "Data dihapus" });
    } catch (error) {
      toast({
        title: "Data belum dihapus",
        description: error?.message || "Coba lagi dalam beberapa saat.",
        variant: "destructive",
      });
    }
  };

  const changeTableSort = (key) => {
    setTableSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const weeklyColumns = useMemo(
    /** @returns {DataTableColumn[]} */ () => [
      {
        key: "week",
        header: "Mgg",
        required: true,
        sortable: true,
        overflow: "nowrap",
        render: (row) => <span className="font-semibold tabular-nums">{row.week}</span>,
      },
      {
        key: "henDayProduction",
        header: "HDP",
        align: "right",
        sortable: true,
        overflow: "nowrap",
        render: (row) => formatValue(row.henDayProduction, "%"),
      },
      {
        key: "fcr",
        header: "FCR",
        align: "right",
        sortable: true,
        overflow: "nowrap",
        render: (row) => formatValue(row.fcr),
      },
      {
        key: "feedIntake",
        header: "Feed",
        align: "right",
        sortable: true,
        overflow: "nowrap",
        render: (row) => formatValue(row.feedIntake),
      },
      {
        key: "eggWeight",
        header: "Egg W.",
        align: "right",
        sortable: true,
        overflow: "nowrap",
        render: (row) => formatValue(row.eggWeight),
      },
      {
        key: "mortality",
        header: "Mort.",
        align: "right",
        sortable: true,
        overflow: "nowrap",
        render: (row) => formatValue(row.mortality, "%"),
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        required: true,
        sticky: "right",
        overflow: "nowrap",
        render: (row) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => startEdit(row)}>
              <AapmIcon name="edit" />Edit
            </Button>
            <OverflowMenu
              label={`Aksi minggu ${row.week}`}
              items={[{ id: "delete", label: "Hapus data minggu ini", icon: "delete", tone: "danger", onSelect: () => setPendingDelete(row) }]}
            />
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

  return (
    <ContentContainer>
      <PageHeader
        title="Farm KPI"
        description="Catat indikator mingguan, baca polanya, lalu putuskan tindakan berikutnya."
        actions={(
          <>
            {devFixtureTools ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewWisman((current) => !current)}>
                <AapmIcon name={previewWisman ? "close" : "analytics"} />
                {previewWisman ? "Kembali ke data API" : "Preview Wisman"}
              </Button>
            ) : null}
            <Button asChild variant="ai"><Link to="/ai-assistant"><AapmIcon name="ai" />Analisis dengan APPI</Link></Button>
            <Button type="button" onClick={openNewEntry}><AapmIcon name="plus" />Catat minggu ini</Button>
          </>
        )}
      />

      {previewWisman ? (
        <Alert tone="warning" title="Preview lokal · tidak disimpan" description={`${WISMAN_FIXTURE_META.coverage}; KPI hanya menghitung baris siap rekonsiliasi.`} />
      ) : null}

      <KPICluster label={`${activeSourceLabel} · ringkasan KPI`} columns={4} items={activeStats} />

      {isLoading ? (
        <EmptyKpiState loading />
      ) : activeRows.length === 0 ? (
        <StateView
          kind="empty"
          icon="kpi"
          hue="teal"
          title="Belum ada data mingguan"
          description="Catat satu minggu data flock untuk mulai melihat tren HDP, FCR, dan biaya."
          action={<Button type="button" onClick={openNewEntry}><AapmIcon name="plus" />Catat data pertama</Button>}
        />
      ) : (
        <section className="grid gap-4" aria-label="Grafik tren">
        {isLoading ? (
          <EmptyKpiState loading />
        ) : activeRows.length === 0 ? (
          <EmptyKpiState />
        ) : (
          <>
            <ChartPanel
              className="min-w-0"
              title={previewWisman ? "HDP & mortality" : "HDP trend"}
              description={
                previewWisman
                  ? "Preview hanya memakai baris Wisman yang siap direkonsiliasi."
                  : "Hen day production berdasarkan umur flock; seri tanpa data tidak dibuat."
              }
              chart={
                productionSeries.length ? (
                  <T7LineChart
                    ariaLabel="Grafik produksi farm"
                    labels={activeLabels}
                    series={productionSeries}
                    height={242}
                    valueFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                ) : (
                  <ChartEmpty message="Belum ada seri produksi yang lengkap untuk divisualkan." />
                )
              }
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartPanel
                className="min-w-0"
                title="FCR trend"
                description={
                  previewWisman
                    ? "FCR belum tersedia pada grain daily fixture."
                    : "Efisiensi pakan dari minggu ke minggu."
                }
                chart={
                  fcrSeries.length ? (
                    <T7LineChart
                      ariaLabel="Grafik tren FCR"
                      labels={activeLabels}
                      series={fcrSeries}
                      height={210}
                      valueFormatter={(value) => value.toFixed(2)}
                    />
                  ) : (
                    <ChartEmpty message="Belum ada data FCR yang lengkap." />
                  )
                }
              />
              <ChartPanel
                className="min-w-0"
                title="Tren berat telur"
                description={
                  previewWisman
                    ? "Berat telur belum tersedia pada Daily Flock Report preview."
                    : "Berat telur rata-rata berdasarkan umur flock."
                }
                chart={
                  eggWeightSeries.length ? (
                    <T7LineChart
                      ariaLabel="Grafik tren berat telur"
                      labels={activeLabels}
                      series={eggWeightSeries}
                      height={210}
                      valueFormatter={(value) => `${value.toFixed(1)} g`}
                    />
                  ) : (
                    <ChartEmpty message="Belum ada data berat telur yang lengkap." />
                  )
                }
              />
              <ChartPanel
                className="min-w-0 lg:col-span-2"
                title="Pendapatan vs biaya"
                description={
                  previewWisman
                    ? "Data biaya tidak ada di Daily Flock Report preview."
                    : "Nilai ditampilkan dalam juta rupiah."
                }
                chart={
                  financeSeries.length ? (
                    <T7LineChart
                      ariaLabel="Grafik revenue dan cost"
                      labels={activeLabels}
                      series={financeSeries}
                      height={210}
                      valueFormatter={(value) => `Rp ${value.toFixed(1)} jt`}
                    />
                  ) : (
                    <ChartEmpty message="Belum ada pasangan revenue dan cost yang lengkap." />
                  )
                }
              />
            </div>
          </>
        )}
        </section>
      )}

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
          loading={isLoading}
          emptyMessage="Belum ada data mingguan. Isi form di samping untuk memulai."
          sort={tableSort}
          onSort={changeTableSort}
        />
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="aapm-form-sheet">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit data minggu ${editing.week}` : "Catat data mingguan"}</SheetTitle>
            <SheetDescription>{editing ? "Perbarui angka lalu simpan perubahan." : "Isi yang Anda punya; field lain boleh kosong."}</SheetDescription>
          </SheetHeader>
          <div className="aapm-form-sheet__body">
        <form id="farm-data-form" noValidate onSubmit={submit} className="grid gap-5">
          <FormSection
            title="Produksi & efisiensi"
            description="Field inti untuk membaca performa flock."
            className="space-y-3"
          >
            <FormGrid columns={2} className="gap-x-3 gap-y-3">
              {primaryFields.map((field) => (
                <MetricInput
                  key={field.key}
                  fieldKey={field.key}
                  label={field.label}
                  value={form[field.key]}
                  required={field.required}
                  error={fieldErrors[field.key]}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, [field.key]: value }))
                  }
                />
              ))}
            </FormGrid>
          </FormSection>

          <FormSection
            title="Konteks operasional"
            description="Suhu, input pakan, dan biaya membantu menjelaskan penyimpangan."
            className="space-y-3"
          >
            <FormGrid columns={2} className="gap-x-3 gap-y-3">
              {contextFields.map((field) => (
                <MetricInput
                  key={field.key}
                  fieldKey={field.key}
                  label={field.label}
                  value={form[field.key]}
                  required={field.required}
                  error={fieldErrors[field.key]}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, [field.key]: value }))
                  }
                />
              ))}
            </FormGrid>
          </FormSection>

          <FormSection
            title="Catatan operasional"
            description="Simpan alasan perubahan, bukan sekadar angka."
            className="space-y-2"
          >
            <Label htmlFor="farm-notes" className="sr-only">
              Catatan operasional
            </Label>
            <Textarea
              id="farm-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Contoh: perubahan pakan, cuaca, atau kondisi kandang."
            />
          </FormSection>

        </form>
          </div>
          <SheetFooter className="aapm-form-sheet__footer">
            <Button type="button" variant="secondary" onClick={() => setSheetOpen(false)}>Batal</Button>
            <Button type="submit" form="farm-data-form" loading={save.isPending}>
              {editing ? "Simpan perubahan" : "Simpan data"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {devFixtureTools && previewWisman && (
        <WismanPreviewSection rows={WISMAN_FIXTURE_ROWS} />
      )}
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
      <Input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** @returns {KPIItem[]} */
function buildStats(rows, { preview = false } = {}) {
  if (preview) {
    const hdp = numericValues(rows, "henDayProduction");
    const mortality = numericValues(rows, "mortality");
    const hdpSeries = completeSeries(rows, "henDayProduction");
    const mortalitySeries = completeSeries(rows, "mortality");
    // Population and egg count are snapshots, not additive measures across
    // dates. Use the latest available date so a two-date preview cannot look
    // like a single farm with double-counted inventory.
    const latestSnapshot = rows[rows.length - 1];
    const populationEnd = latestSnapshot?.populationEnd;
    const eggCount = latestSnapshot?.eggCount;
    return [
      {
        icon: "chart",
        label: "Rata-rata HDP",
        value: metricValue(average(hdp), "%", 1),
        note: `${rows.length} tanggal · baris siap rekonsiliasi`,
        tone: "warning",
        colorway: 3,
        emphasis: "solid",
        chart: chartFor(hdpSeries, "HDP preview", 3, "warning"),
        trend: trendFor(hdpSeries),
      },
      {
        icon: "users",
        label: "Populasi akhir",
        value: populationEnd ? formatInteger(populationEnd) : "—",
        note: latestSnapshot ? `Snapshot ${formatDateLabel(latestSnapshot.date)}` : "Snapshot terakhir",
        tone: "info",
        colorway: 2,
        emphasis: "solid",
        chart: chartFor(completeSeries(rows, "populationEnd"), "Populasi akhir", 2, "info"),
      },
      {
        icon: "package",
        label: "Total telur",
        value: eggCount ? formatInteger(eggCount) : "—",
        note: latestSnapshot ? `Produksi harian · ${formatDateLabel(latestSnapshot.date)}` : "Telur TB + TR + TP",
        tone: "accent",
        colorway: 4,
        emphasis: "solid",
        chart: chartFor(completeSeries(rows, "eggCount"), "Total telur", 4, "chart"),
      },
      {
        icon: "warning",
        label: "Rata-rata mortalitas",
        value: metricValue(average(mortality), "%", 2),
        note: "Decrease ÷ end · indikatif",
        tone: "danger",
        colorway: 5,
        emphasis: "solid",
        chart: chartFor(mortalitySeries, "Preview mortalitas", 5, "danger"),
        trend: trendFor(mortalitySeries, { lowerIsBetter: true }),
      },
    ];
  }

  const hdp = numericValues(rows, "henDayProduction");
  const fcr = numericValues(rows, "fcr");
  const eggWeight = numericValues(rows, "eggWeight");
  const hdpSeries = completeSeries(rows, "henDayProduction");
  const fcrSeries = completeSeries(rows, "fcr");
  const eggWeightSeries = completeSeries(rows, "eggWeight");
  const profit = rows
    .map((row) => {
      const revenue = toNumber(row.revenue);
      const cost = toNumber(row.cost);
      return Number.isFinite(revenue) && Number.isFinite(cost) ? revenue - cost : NaN;
    })
    .filter((value) => Number.isFinite(value));
  const profitSeries = completeDerivedSeries(rows, (row) => {
    const revenue = toNumber(row.revenue);
    const cost = toNumber(row.cost);
    return Number.isFinite(revenue) && Number.isFinite(cost) ? revenue - cost : NaN;
  });
  const totalProfit = profit.reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0,
  );
  return [
    {
      icon: "chart",
      label: "Rata-rata HDP",
      value: metricValue(average(hdp), "%", 1),
      note: `${rows.length} minggu · Hen day production`,
      tone: "warning",
      colorway: 3,
      emphasis: "solid",
      chart: chartFor(hdpSeries, "HDP", 3, "warning"),
      trend: trendFor(hdpSeries),
    },
      {
        icon: "progress",
      label: "Rata-rata FCR",
      value: metricValue(average(fcr), "", 2),
      note: "Feed conversion · data aktual",
      tone: "success",
      colorway: 1,
      emphasis: "solid",
      chart: chartFor(fcrSeries, "FCR", 1, "success"),
      trend: trendFor(fcrSeries, { lowerIsBetter: true }),
    },
    {
      icon: "finance",
      label: "Total laba",
      value: profit.length ? formatMillion(totalProfit) : "—",
      note: profit.length
        ? totalProfit >= 0
          ? "Margin positif"
          : "Perlu review biaya"
        : "Menunggu data revenue/cost",
      tone: totalProfit >= 0 ? "info" : "danger",
      colorway: 2,
      emphasis: "solid",
      chart: chartFor(profitSeries, "Profit", 2, totalProfit >= 0 ? "info" : "danger"),
      trend: trendFor(profitSeries),
    },
    {
      icon: "package",
      label: "Rata-rata berat telur",
      value: metricValue(average(eggWeight), " g", 1),
      note: "Berat telur · data aktual",
      tone: "accent",
      colorway: 4,
      emphasis: "solid",
      chart: chartFor(eggWeightSeries, "Berat telur", 4, "chart"),
      trend: trendFor(eggWeightSeries),
    },
  ];
}

function chartFor(values, label, colorway, tone) {
  const usable = values.map(toNumber);
  // A graphical cue must preserve the source grain. Do not silently remove a
  // missing period and connect two non-adjacent observations as if they were
  // consecutive; the caller can still show the numeric aggregate and note.
  return usable.length > 1 && usable.every((value) => Number.isFinite(value)) ? (
    <Sparkline
      aria-label={label}
      label={label}
      values={usable}
      colorway={colorway}
      tone={tone}
    />
  ) : null;
}

function trendFor(values, { lowerIsBetter = false } = {}) {
  const usable = values.map(toNumber);
  if (usable.length < 2 || !usable.every((value) => Number.isFinite(value)) || usable[0] === 0) return null;
  const first = usable[0];
  const last = usable[usable.length - 1];
  const delta = ((last - first) / Math.abs(first)) * 100;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const sentiment =
    delta === 0
      ? "neutral"
      : lowerIsBetter
        ? delta < 0
          ? "positive"
          : "negative"
        : delta > 0
          ? "positive"
          : "negative";
  return (
    <TrendIndicator
      direction={direction}
      sentiment={sentiment}
      value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
      context="vs periode awal"
      variant="soft"
    />
  );
}

function chartSeries(rows, key, label) {
  const values = completeSeries(rows, key);
  return values.length ? [{ id: key, label, values }] : [];
}

function completeSeries(rows, key) {
  if (!rows.length) return [];
  const values = rows.map((row) => toNumber(row[key]));
  return values.every((value) => Number.isFinite(value)) ? values : [];
}

function completeDerivedSeries(rows, derive) {
  if (!rows.length) return [];
  const values = rows.map(derive);
  return values.every((value) => Number.isFinite(value)) ? values : [];
}

function numericValues(rows, key) {
  return rows
    .map((row) => toNumber(row[key]))
    .filter((value) => Number.isFinite(value));
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

function WismanPreviewSection({ rows }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredRows =
    statusFilter === "all"
      ? rows
      : rows.filter((row) => row.reviewStatus === statusFilter);
  /** @type {DataTableColumn[]} */
  const columns = [
    { key: "date", header: "Tanggal", required: true, sortable: true, overflow: "nowrap" },
    { key: "cage", header: "Kandang", required: true, overflow: "nowrap" },
    { key: "employee", header: "Pelapor", overflow: "nowrap" },
    {
      key: "ageWeeks",
      header: "Umur",
      align: "right",
      sortable: true,
      overflow: "nowrap",
      render: (row) => `${row.ageWeeks} mgg`,
    },
    {
      key: "end",
      header: "Pop. akhir",
      align: "right",
      sortable: true,
      overflow: "nowrap",
      render: (row) => formatInteger(row.end),
    },
    {
      key: "totalEgg",
      header: "Total telur",
      align: "right",
      sortable: true,
      overflow: "nowrap",
      render: (row) => formatInteger(row.totalEgg),
    },
    {
      key: "productionPct",
      header: "HDP",
      align: "right",
      sortable: true,
      overflow: "nowrap",
      render: (row) => `${row.productionPct.toFixed(2)}%`,
    },
    {
      key: "intake",
      header: "Intake",
      align: "right",
      sortable: true,
      overflow: "nowrap",
      render: (row) => `${row.intake} g`,
    },
    {
      key: "reviewStatus",
      header: "Status",
      required: true,
      overflow: "nowrap",
      render: (row) => (
        <Badge
          variant={
            row.reviewStatus === "SIAP_DIREKONSILIASI" ? "success" : "warning"
          }
        >
          {row.reviewStatus === "SIAP_DIREKONSILIASI" ? "Siap" : "Review"}
        </Badge>
      ),
    },
  ];

  return (
    <section className="mt-8 space-y-3" aria-labelledby="wisman-preview-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="aapm-eyebrow text-brand-orange">Fixture audit</p>
          <h2 id="wisman-preview-title" className="text-lg font-semibold tracking-[-0.02em]">
            Wisman Farm · daily cage preview
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {WISMAN_FIXTURE_META.source}. Baris OCR yang perlu review tetap terlihat untuk audit,
            tetapi tidak ikut menghitung KPI di atas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filteredRows.length}/{rows.length} baris
          </Badge>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "all" ? "outline" : "soft"}
            onClick={() =>
              setStatusFilter(
                statusFilter === "all" ? "SIAP_DIREKONSILIASI" : "all",
              )
            }
          >
            {statusFilter === "all" ? "Tampilkan siap saja" : "Tampilkan semua"}
          </Button>
        </div>
      </div>
      <DataTable
        className="aapm-token-table"
        caption="Preview data Wisman Farm pada grain harian per kandang"
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row.id}
        density="compact"
        responsive="scroll"
        emptyMessage="Tidak ada baris pada filter ini."
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Preview-only · tidak memanggil endpoint simpan dan tidak mengubah tenant/DB. Cocok untuk
        menguji density, status, responsive table, dan warna chart sebelum kontrak daily input
        diputuskan.
      </p>
    </section>
  );
}

function ChartEmpty({ message }) {
  return (
    <div className="flex min-h-[10rem] items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border bg-surface-subtle px-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function EmptyKpiState({ loading = false } = {}) {
  return (
    <Card className="aapm-token-card border-dashed">
      <CardContent className="p-10 text-center sm:p-14">
        <IconTile icon="analytics" tone="blue" size="lg" className="mx-auto" />
        <h2 className="mt-4 text-lg font-semibold">
          {loading ? "Memuat data KPI…" : "Mulai dengan data mingguan pertama"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {loading
            ? "Kami sedang menyiapkan ringkasan produksi Anda."
            : "Masukkan HDP, pakan, produksi, dan biaya untuk melihat tren operasional farm."}
        </p>
      </CardContent>
    </Card>
  );
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numeric(value) {
  return value === "" || value === null || value === undefined ? null : parseFloat(value);
}

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : NaN;
}

function metricValue(value, suffix = "", decimals = 1) {
  return Number.isFinite(value) ? `${value.toFixed(decimals)}${suffix}` : "—";
}

function formatMillion(value) {
  return Number.isFinite(value) ? `Rp ${(value / 1000000).toFixed(1)} jt` : "—";
}

function formatInteger(value) {
  return Number.isFinite(toNumber(value))
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(toNumber(value))
    : "—";
}

function formatDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

function formatValue(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "—" : `${value}${suffix}`;
}
