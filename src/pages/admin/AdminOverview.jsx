// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { DataTable, IconTile, KPICluster, Surface } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminOverview } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

const metricAppearance = {
  learners: { tone: "success", icon: "users", colorway: 1 },
  active: { tone: "info", icon: "analytics", colorway: 2 },
  courses: { tone: "warning", icon: "book", colorway: 3 },
  completion: { tone: "success", icon: "approve", colorway: 4 },
  analytics: { tone: "neutral", icon: "analytics", colorway: 5 },
};

export default function AdminOverview() {
  const { data, isLoading, error, refetch } = useAdminOverview();

  return (
    <AdminPageFrame title="Ringkasan Academy" description="Pantau data pembelajaran yang tersedia di API native tanpa mengubah data produksi.">
      {isLoading ? <AdminLoading /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5">
        <KPICluster
          className="aapm-admin-kpi"
          label="Ringkasan administrasi"
          columns={4}
          variant="cards"
          items={(data?.metrics || []).map((metric) => {
            const appearance = metricAppearance[metric.key] || metricAppearance.analytics;
            return {
              icon: appearance.icon,
              label: metric.label,
              note: metric.detail || "Data langsung",
              value: `${metric.value ?? "—"}${metric.suffix || ""}`,
              tone: appearance.tone,
              colorway: appearance.colorway,
              emphasis: "solid",
            };
          })}
        />

        <Surface variant="muted" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><IconTile icon="analytics" tone="green" size="sm" /><p className="text-sm leading-6 text-muted-foreground">{data?.dataNote}</p></div><Link className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-green hover:underline" to="/admin/learners">Lihat learners <AapmIcon name="arrowRight" className="h-4 w-4" /></Link></Surface>

        <div className="grid gap-5 xl:grid-cols-2">
          <Surface className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] px-5 py-4"><div><h2 className="text-sm font-semibold">Registrasi terbaru</h2><p className="mt-1 text-xs text-muted-foreground">Akun learner terakhir yang masuk ke sistem.</p></div><AapmIcon name="users" className="h-5 w-5 text-brand-green" /></div>{data?.recentRegistrations?.length ? <DataTable caption="Registrasi learner terbaru" responsive="stacked" rows={data.recentRegistrations} rowKey={(user) => String(user.id)} columns={[{ key: "learner", header: "Learner", required: true, overflow: "wrap", render: (user) => <div><Link to={`/admin/learners/${user.id}`} className="font-medium hover:text-brand-green hover:underline">{user.full_name || user.email}</Link><div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div></div> }, { key: "createdAt", header: "Terdaftar", align: "right", overflow: "nowrap", render: (user) => <span className="text-xs text-muted-foreground">{formatAdminDate(user.created_at)}</span> }]} /> : <div className="p-5 text-sm text-muted-foreground">Belum ada registrasi yang dapat ditampilkan.</div>}</Surface>
          <Surface className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] px-5 py-4"><div><h2 className="text-sm font-semibold">Penyelesaian terbaru</h2><p className="mt-1 text-xs text-muted-foreground">Progress modul yang ditandai selesai.</p></div><AapmIcon name="modules" className="h-5 w-5 text-brand-orange" /></div>{data?.recentCompletions?.length ? <DataTable caption="Penyelesaian modul terbaru" responsive="stacked" rows={data.recentCompletions} rowKey={(item) => `${item.userId}-${item.moduleNumber}-${item.completedAt}`} columns={[{ key: "learner", header: "Learner", required: true, overflow: "wrap", render: (item) => <Link to={`/admin/learners/${item.userId}`} className="font-medium hover:text-brand-green hover:underline">{item.fullName || item.email}</Link> }, { key: "module", header: "Modul", overflow: "ellipsis", render: (item) => <div className="max-w-[220px] truncate text-xs text-muted-foreground">{item.moduleTitle || `Modul ${item.moduleNumber}`}</div> }, { key: "completedAt", header: "Selesai", align: "right", overflow: "nowrap", render: (item) => <span className="text-xs text-muted-foreground">{formatAdminDate(item.completedAt)}</span> }]} /> : <div className="p-5 text-sm text-muted-foreground">Belum ada penyelesaian modul yang tersimpan.</div>}</Surface>
        </div>
      </div>}
    </AdminPageFrame>
  );
}
