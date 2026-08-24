// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, UsersRound } from "lucide-react";
import { Icon, Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives";
import { useAdminOverview } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

const metricAppearance = {
  learners: { tone: "green", icon: "users" },
  active: { tone: "blue", icon: "analytics" },
  courses: { tone: "orange", icon: "course" },
  completion: { tone: "violet", icon: "certificate" },
};

export default function AdminOverview() {
  const { data, isLoading, error, refetch } = useAdminOverview();

  return (
    <AdminPageFrame title="Academy overview" description="Pantau data pembelajaran yang tersedia di API native tanpa mengubah data produksi.">
      {isLoading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.metrics || []).map((metric) => {
            const appearance = metricAppearance[metric.key] || metricAppearance.analytics;
            return <Surface key={metric.key} tone={appearance.tone} className="p-4 shadow-none"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-white/70 p-2"><Icon name={appearance.icon} className="h-5 w-5" /></div><span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Live data</span></div><div className="mt-5 text-3xl font-semibold tracking-[-0.05em] tabular-nums">{metric.value}{metric.suffix || ""}</div><div className="mt-1 text-sm font-semibold">{metric.label}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{metric.detail}</div></Surface>;
          })}
        </div>

        <Surface variant="muted" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-surface-elevated p-2 text-brand-green"><ChartNoAxesCombined className="h-5 w-5" /></div><p className="text-sm leading-6 text-muted-foreground">{data?.dataNote}</p></div><Link className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-green hover:underline" to="/admin/learners">Lihat learners <ArrowRight className="h-4 w-4" /></Link></Surface>

        <div className="grid gap-5 xl:grid-cols-2">
          <Surface className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] px-5 py-4"><div><h2 className="text-sm font-semibold">Registrasi terbaru</h2><p className="mt-1 text-xs text-muted-foreground">Akun learner terakhir yang masuk ke sistem.</p></div><UsersRound className="h-5 w-5 text-brand-green" /></div>{data?.recentRegistrations?.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Learner</TableHead><TableHead className="pr-5 text-right">Terdaftar</TableHead></TableRow></TableHeader><TableBody>{data.recentRegistrations.map((user) => <TableRow key={user.id}><TableCell className="pl-5"><Link to={`/admin/learners/${user.id}`} className="font-medium hover:text-brand-green hover:underline">{user.full_name || user.email}</Link><div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div></TableCell><TableCell className="pr-5 text-right text-xs text-muted-foreground">{formatAdminDate(user.created_at)}</TableCell></TableRow>)}</TableBody></Table> : <div className="p-5 text-sm text-muted-foreground">Belum ada registrasi yang dapat ditampilkan.</div>}</Surface>
          <Surface className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] px-5 py-4"><div><h2 className="text-sm font-semibold">Penyelesaian terbaru</h2><p className="mt-1 text-xs text-muted-foreground">Progress modul yang ditandai selesai.</p></div><BookOpenCheck className="h-5 w-5 text-brand-orange" /></div>{data?.recentCompletions?.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Learner</TableHead><TableHead>Modul</TableHead><TableHead className="pr-5 text-right">Selesai</TableHead></TableRow></TableHeader><TableBody>{data.recentCompletions.map((item) => <TableRow key={`${item.userId}-${item.moduleNumber}-${item.completedAt}`}><TableCell className="pl-5"><Link to={`/admin/learners/${item.userId}`} className="font-medium hover:text-brand-green hover:underline">{item.fullName || item.email}</Link></TableCell><TableCell><div className="max-w-[220px] truncate text-xs text-muted-foreground">{item.moduleTitle || `Modul ${item.moduleNumber}`}</div></TableCell><TableCell className="pr-5 text-right text-xs text-muted-foreground">{formatAdminDate(item.completedAt)}</TableCell></TableRow>)}</TableBody></Table> : <div className="p-5 text-sm text-muted-foreground">Belum ada penyelesaian modul yang tersimpan.</div>}</Surface>
        </div>
      </div>}
    </AdminPageFrame>
  );
}
