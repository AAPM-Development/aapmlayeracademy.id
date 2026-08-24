import React, { useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, IconButton, IconTile, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from "@/components/primitives";
import { useFarmData, useSaveFarmData, useDeleteFarmData } from "@/lib/useCourseData";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const chartGrid = "hsl(var(--border))";
const chartTooltip = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--popover-foreground))", fontSize: 12 };

function emptyForm() {
  return { week: "", henDayProduction: "", feedIntake: "", eggWeight: "", mortality: "", waterIntake: "", temperature: "", humidity: "", revenue: "", cost: "", fcr: "", notes: "" };
}

const numberFields = [
  { key: "week", label: "Umur (minggu)", required: true }, { key: "henDayProduction", label: "HDP (%)" }, { key: "feedIntake", label: "Feed intake (g)" }, { key: "eggWeight", label: "Egg weight (g)" }, { key: "fcr", label: "FCR" }, { key: "mortality", label: "Mortality (%)" }, { key: "waterIntake", label: "Water (ml)" }, { key: "temperature", label: "Suhu (°C)" }, { key: "humidity", label: "Humidity (%)" }, { key: "revenue", label: "Revenue (Rp)" }, { key: "cost", label: "Cost (Rp)" },
];

export default function KpiDashboard() {
  const { data: rows = [], isLoading } = useFarmData();
  const save = useSaveFarmData();
  const del = useDeleteFarmData();
  const saveFarmData = /** @type {any} */ (save.mutateAsync);
  const deleteFarmData = /** @type {any} */ (del.mutateAsync);
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const sorted = [...rows].sort((a, b) => a.week - b.week);
  const avg = (key) => sorted.length ? (sorted.reduce((sum, row) => sum + (parseFloat(row[key]) || 0), 0) / sorted.length).toFixed(sorted[0] && hasDecimal(sorted[0][key]) ? 1 : 0) : "0";
  const totalRevenue = sorted.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
  const totalCost = sorted.reduce((sum, row) => sum + (parseFloat(row.cost) || 0), 0);
  const profit = totalRevenue - totalCost;

  const submit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key === "notes" ? value : numeric(value)]));
    await saveFarmData({ id: editing?.id, data });
    toast({ title: editing ? "Data diperbarui" : "Data farm ditambahkan" });
    setForm(emptyForm());
    setEditing(null);
  };

  const startEdit = (row) => {
    setEditing(row);
    setForm({ week: row.week, henDayProduction: row.henDayProduction, feedIntake: row.feedIntake, eggWeight: row.eggWeight, mortality: row.mortality, waterIntake: row.waterIntake, temperature: row.temperature, humidity: row.humidity, revenue: row.revenue, cost: row.cost, fcr: row.fcr, notes: row.notes || "" });
  };

  const remove = async (id) => {
    await deleteFarmData(id);
    toast({ title: "Data dihapus" });
  };

  const stats = [
    { label: "Avg HDP", value: `${avg("henDayProduction")}%`, detail: "Hen day production", icon: "egg", tone: "orange" },
    { label: "Avg FCR", value: avg("fcr") || "—", detail: "Feed conversion", icon: "trend", tone: "green" },
    { label: "Total profit", value: `Rp ${(profit / 1000000).toFixed(1)}jt`, detail: profit >= 0 ? "Margin positif" : "Perlu review biaya", icon: "finance", tone: profit >= 0 ? "green" : "orange" },
    { label: "Avg egg weight", value: `${avg("eggWeight")} g`, detail: "Berat telur", icon: "weight", tone: "blue" },
  ];

  return (
    <ContentContainer>
      <PageHeader eyebrow="Farm performance" title="Farm KPI dashboard" description="Catat indikator mingguan, baca pola produksi, lalu ambil keputusan yang lebih presisi." actions={<Button asChild variant="outline"><Link to="/ai-assistant"><AapmIcon name="ai" /> Analisis dengan AI</Link></Button>} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => <KpiStat key={stat.label} {...stat} index={index} />)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,2fr)]">
        <Card className="h-fit border-border bg-card xl:sticky xl:top-5">
          <CardHeader className="p-5 pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">{editing ? "Edit data mingguan" : "Input data mingguan"}</CardTitle><CardDescription className="mt-1">Angka yang rapi membuat tren lebih mudah dibaca.</CardDescription></div><IconTile icon={editing ? "edit" : "finance"} tone={editing ? "orange" : "lime"} size="sm" /></div></CardHeader>
          <CardContent className="p-5 pt-2">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">{numberFields.map((field) => <MetricInput key={field.key} label={field.label} value={form[field.key]} required={field.required} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />)}</div>
              <div className="space-y-2"><Label htmlFor="farm-notes" className="text-xs text-muted-foreground">Catatan operasional</Label><Textarea id="farm-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contoh: perubahan pakan, cuaca, atau kondisi kandang." /></div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm()); }}>Batal</Button>}<Button type="submit" className="flex-1" disabled={save.isPending}>{editing ? "Simpan perubahan" : "Tambah data"}<AapmIcon name="arrowRight" /></Button></div>
            </form>
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-6">
          {isLoading ? <EmptyKpiState loading /> : sorted.length === 0 ? <EmptyKpiState /> : <>
            <ChartCard title="Production curve" description="HDP dan berat telur berdasarkan umur flock.">
              <ResponsiveContainer width="100%" height={272}><ComposedChart data={sorted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Area yAxisId="left" type="monotone" dataKey="henDayProduction" name="HDP %" stroke="hsl(var(--brand-aapm-lime))" fill="hsl(var(--brand-aapm-lime) / 0.18)" strokeWidth={2.5} /><Line yAxisId="right" type="monotone" dataKey="eggWeight" name="Egg weight (g)" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="FCR trend" description="Efisiensi pakan dari minggu ke minggu."><ResponsiveContainer width="100%" height={208}><LineChart data={sorted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Line type="monotone" dataKey="fcr" name="FCR" stroke="hsl(var(--brand-aapm-green))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--brand-aapm-green))" }} /></LineChart></ResponsiveContainer></ChartCard>
              <ChartCard title="Revenue vs cost" description="Nilai ditampilkan dalam juta rupiah."><ResponsiveContainer width="100%" height={208}><BarChart data={sorted.map((row) => ({ ...row, revenueM: (row.revenue || 0) / 1e6, costM: (row.cost || 0) / 1e6 }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Bar dataKey="revenueM" name="Revenue" fill="hsl(var(--brand-aapm-green))" radius={[6, 6, 0, 0]} /><Bar dataKey="costM" name="Cost" fill="hsl(var(--brand-aapm-orange))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
            </div>

            <Card className="overflow-hidden"><CardHeader className="p-5 pb-3"><CardTitle className="text-base">Riwayat input</CardTitle><CardDescription className="mt-1">Kelola dan koreksi data mingguan Anda.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-surface-subtle"><TableRow><TableHead>Mgg</TableHead><TableHead className="text-right">HDP</TableHead><TableHead className="text-right">FCR</TableHead><TableHead className="text-right">Feed</TableHead><TableHead className="text-right">Egg W.</TableHead><TableHead className="text-right">Mort.</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>{sorted.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.week}</TableCell><TableCell className="text-right">{formatValue(row.henDayProduction, "%")}</TableCell><TableCell className="text-right">{formatValue(row.fcr)}</TableCell><TableCell className="text-right">{formatValue(row.feedIntake)}</TableCell><TableCell className="text-right">{formatValue(row.eggWeight)}</TableCell><TableCell className="text-right">{formatValue(row.mortality, "%")}</TableCell><TableCell><div className="flex justify-end gap-1"><IconButton label={`Edit minggu ${row.week}`} tooltip="Edit data" variant="ghost" onClick={() => startEdit(row)}><AapmIcon name="edit" className="h-4 w-4" /></IconButton><IconButton label={`Hapus minggu ${row.week}`} tooltip="Hapus data" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => remove(row.id)}><AapmIcon name="delete" className="h-4 w-4" /></IconButton></div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          </>}
        </section>
      </div>
    </ContentContainer>
  );
}

function MetricInput({ label, value, required = false, onChange }) {
  const id = `farm-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label><Input id={id} type="number" inputMode="decimal" value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
}

function KpiStat({ label, value, detail, icon, tone, index }) {
  const accent = {
    green: { border: "border-t-brand-green", icon: "text-brand-green" },
    orange: { border: "border-t-brand-orange", icon: "text-brand-orange" },
    blue: { border: "border-t-info", icon: "text-info" },
  }[tone] || { border: "border-t-brand-orange", icon: "text-brand-orange" };
  return <Card className={cn("academy-enter aapm-interactive-card border border-border border-t-[3px] bg-card shadow-none", accent.border)} style={{ animationDelay: `${index * 60}ms` }}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><AapmIcon name={icon} className={cn("h-5 w-5", accent.icon)} /><span className="text-[10px] font-medium text-muted-foreground">KPI farm</span></div><div className="mt-4 truncate text-xl font-semibold tracking-[-0.04em] tabular-nums">{value}</div><div className="mt-1 text-xs font-medium text-foreground/80">{label}</div><div className="mt-1 text-[11px] text-muted-foreground">{detail}</div></CardContent></Card>;
}

function ChartCard({ title, description, children }) {
  return <Card className="min-w-0"><CardHeader className="p-5 pb-2"><CardTitle className="text-base">{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></CardHeader><CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">{children}</CardContent></Card>;
}

function EmptyKpiState({ loading = false } = {}) {
  return <Card className="border-dashed"><CardContent className="p-10 text-center sm:p-14"><IconTile icon="analytics" tone="lime" size="lg" className="mx-auto" /><h2 className="mt-4 text-lg font-semibold">{loading ? "Memuat data KPI…" : "Mulai dengan data mingguan pertama"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{loading ? "Kami sedang menyiapkan ringkasan produksi Anda." : "Masukkan HDP, pakan, produksi, dan biaya untuk melihat tren operasional farm."}</p></CardContent></Card>;
}

function numeric(value) { return value === "" || value === null || value === undefined ? null : parseFloat(value); }
function hasDecimal(value) { return String(value).includes("."); }
function formatValue(value, suffix = "") { return value === null || value === undefined || value === "" ? "—" : `${value}${suffix}`; }
