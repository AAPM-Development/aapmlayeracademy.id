import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from 'recharts';
import { Plus, Trash2, BarChart3, Egg, TrendingUp, DollarSign, Sparkles, Pencil } from 'lucide-react';
import { useFarmData, useSaveFarmData, useDeleteFarmData } from '@/lib/useCourseData';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function KpiDashboard() {
  const { data: rows = [], isLoading } = useFarmData();
  const save = useSaveFarmData();
  const del = useDeleteFarmData();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return { week: '', henDayProduction: '', feedIntake: '', eggWeight: '', mortality: '', waterIntake: '', temperature: '', humidity: '', revenue: '', cost: '', fcr: '', notes: '' };
  }

  const sorted = [...rows].sort((a, b) => a.week - b.week);

  const avg = (key) => sorted.length ? (sorted.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0) / sorted.length).toFixed(sorted[0] && r2(sorted[0][key]) ? 1 : 0) : '0';

  const totalRev = sorted.reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0);
  const totalCost = sorted.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
  const profit = totalRev - totalCost;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      week: parseInt(form.week, 10),
      henDayProduction: f(form.henDayProduction),
      feedIntake: f(form.feedIntake),
      eggWeight: f(form.eggWeight),
      mortality: f(form.mortality),
      waterIntake: f(form.waterIntake),
      temperature: f(form.temperature),
      humidity: f(form.humidity),
      revenue: f(form.revenue),
      cost: f(form.cost),
      fcr: f(form.fcr),
      notes: form.notes,
    };
    await save.mutateAsync({ id: editing?.id, data: payload });
    toast({ title: editing ? 'Data diperbarui' : 'Data farm ditambahkan' });
    setForm(emptyForm());
    setEditing(null);
  };

  const edit = (r) => {
    setEditing(r);
    setForm({ week: r.week, henDayProduction: r.henDayProduction, feedIntake: r.feedIntake, eggWeight: r.eggWeight, mortality: r.mortality, waterIntake: r.waterIntake, temperature: r.temperature, humidity: r.humidity, revenue: r.revenue, cost: r.cost, fcr: r.fcr, notes: r.notes || '' });
  };

  const remove = async (id) => {
    await del.mutateAsync(id);
    toast({ title: 'Data dihapus' });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-amber-600" /> Farm KPI Dashboard</h1>
        <Link to="/ai-assistant" className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-medium">
          <Sparkles className="h-4 w-4" /> Analisis dengan AI
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Input data mingguan farm Anda — dashboard menghitung KPI dan menampilkan tren produksi.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Egg} label="Avg HDP" value={`${avg('henDayProduction')}%`} tint="text-amber-600 bg-amber-50" />
        <Stat icon={TrendingUp} label="Avg FCR" value={avg('fcr') || '—'} tint="text-sky-600 bg-sky-50" />
        <Stat icon={DollarSign} label="Total Profit" value={`Rp ${(profit / 1000000).toFixed(1)}jt`} tint={profit >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} />
        <Stat icon={BarChart3} label="Avg Egg Weight" value={`${avg('eggWeight')} g`} tint="text-violet-600 bg-violet-50" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input form */}
        <div className="lg:col-span-1">
          <form onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-sm sticky top-4">
            <h2 className="font-semibold mb-3 text-sm">{editing ? 'Edit Data Mingguan' : 'Input Data Mingguan'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Umur (minggu)" v={form.week} on={v => setForm({ ...form, week: v })} req />
              <Input label="HDP (%)" v={form.henDayProduction} on={v => setForm({ ...form, henDayProduction: v })} />
              <Input label="Feed Intake (g)" v={form.feedIntake} on={v => setForm({ ...form, feedIntake: v })} />
              <Input label="Egg Weight (g)" v={form.eggWeight} on={v => setForm({ ...form, eggWeight: v })} />
              <Input label="FCR" v={form.fcr} on={v => setForm({ ...form, fcr: v })} />
              <Input label="Mortality (%)" v={form.mortality} on={v => setForm({ ...form, mortality: v })} />
              <Input label="Water (ml)" v={form.waterIntake} on={v => setForm({ ...form, waterIntake: v })} />
              <Input label="Suhu (°C)" v={form.temperature} on={v => setForm({ ...form, temperature: v })} />
              <Input label="Humidity (%)" v={form.humidity} on={v => setForm({ ...form, humidity: v })} />
              <Input label="Revenue (Rp)" v={form.revenue} on={v => setForm({ ...form, revenue: v })} />
              <Input label="Cost (Rp)" v={form.cost} on={v => setForm({ ...form, cost: v })} />
            </div>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan"
              className="w-full mt-3 rounded-lg border px-3 py-2 text-sm outline-none focus:border-amber-500"
              rows={2}
            />
            <div className="flex gap-2 mt-3">
              <button type="submit" className="flex-1 rounded-xl bg-amber-600 text-white py-2.5 text-sm font-semibold hover:bg-amber-700">
                {editing ? 'Update' : 'Tambah Data'}
              </button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }} className="rounded-xl border px-4 text-sm font-medium hover:bg-muted">
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Charts + table */}
        <div className="lg:col-span-2 space-y-6">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Belum ada data. Masukkan data mingguan untuk melihat tren KPI.
            </div>
          ) : (
            <>
              <Chart title="Production Curve — HDP & Egg Weight">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={sorted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} unit=" mg" />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area yAxisId="l" type="monotone" dataKey="henDayProduction" name="HDP %" stroke="#f59e0b" fill="#fef3c7" />
                    <Line yAxisId="r" type="monotone" dataKey="eggWeight" name="Egg Weight (g)" stroke="#8b5cf6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Chart>

              <div className="grid sm:grid-cols-2 gap-6">
                <Chart title="FCR Trend">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={sorted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} unit=" mg" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="fcr" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Chart>
                <Chart title="Revenue vs Cost (Rp jt)">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sorted.map(r => ({ ...r, revenueM: (r.revenue || 0) / 1e6, costM: (r.cost || 0) / 1e6 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} unit=" mg" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenueM" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="costM" name="Cost" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Chart>
              </div>

              <div className="rounded-2xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Mgg</th>
                      <th className="px-3 py-2 text-right font-medium">HDP</th>
                      <th className="px-3 py-2 text-right font-medium">FCR</th>
                      <th className="px-3 py-2 text-right font-medium">Feed</th>
                      <th className="px-3 py-2 text-right font-medium">EggW</th>
                      <th className="px-3 py-2 text-right font-medium">Mort</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{r.week}</td>
                        <td className="px-3 py-2 text-right">{r.henDayProduction ?? '—'}%</td>
                        <td className="px-3 py-2 text-right">{r.fcr ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{r.feedIntake ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{r.eggWeight ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{r.mortality ?? '—'}%</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => edit(r)} className="text-muted-foreground hover:text-amber-600 mr-2"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function f(v) { return v === '' || v === null || v === undefined ? null : parseFloat(v); }
function r2(v) { return String(v).includes('.'); }

function Input({ label, v, on, req }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={v ?? ''}
        onChange={e => on(e.target.value)}
        required={req}
        className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-amber-500"
      />
    </label>
  );
}

function Stat({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tint} mb-2.5`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Chart({ title, children }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}