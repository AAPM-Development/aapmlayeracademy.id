// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { Button, DataTable, IconTile, KPICluster, StateView, Surface } from "@/components/primitives";
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

function PanelHead({ icon, hue, title, description }) {
  return (
    <div className="aapm-panel-head">
      <div className="min-w-0">
        <h2 className="aapm-panel-head__title">{title}</h2>
        <p className="aapm-panel-head__desc">{description}</p>
      </div>
      <IconTile icon={icon} hue={hue} size="sm" />
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, error, refetch } = useAdminOverview();

  return (
    <AdminPageFrame
      title="Ringkasan Academy"
      description="Pantau pembelajaran dari data native. Halaman ini hanya membaca dan tidak mengubah data produksi."
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : (
        <div className="aapm-admin-stack">
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

          <Surface className="aapm-admin-note">
            <IconTile icon="analytics" hue="green" size="sm" />
            <p>{data?.dataNote}</p>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/learners">
                Lihat peserta
                <AapmIcon name="arrowRight" />
              </Link>
            </Button>
          </Surface>

          <div className="aapm-admin-split">
            <Surface className="aapm-admin-panel">
              <PanelHead icon="users" hue="green" title="Registrasi terbaru" description="Akun learner terakhir yang terdaftar." />
              {data?.recentRegistrations?.length ? (
                <DataTable
                  caption="Registrasi learner terbaru"
                  responsive="stacked"
                  rows={data.recentRegistrations}
                  rowKey={(user) => String(user.id)}
                  columns={[
                    {
                      key: "learner",
                      header: "Learner",
                      required: true,
                      overflow: "wrap",
                      render: (user) => (
                        <div className="min-w-0">
                          <Link to={`/admin/learners/${user.id}`} className="aapm-link font-medium">{user.full_name || user.email}</Link>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      ),
                    },
                    {
                      key: "createdAt",
                      header: "Terdaftar",
                      align: "right",
                      overflow: "nowrap",
                      render: (user) => <span className="text-xs text-muted-foreground">{formatAdminDate(user.created_at)}</span>,
                    },
                  ]}
                />
              ) : (
                <StateView kind="empty" icon="users" title="Belum ada registrasi" description="Registrasi learner baru akan muncul di sini." framed={false} compact />
              )}
            </Surface>

            <Surface className="aapm-admin-panel">
              <PanelHead icon="modules" hue="orange" title="Penyelesaian terbaru" description="Modul yang ditandai selesai oleh learner." />
              {data?.recentCompletions?.length ? (
                <DataTable
                  caption="Penyelesaian modul terbaru"
                  responsive="stacked"
                  rows={data.recentCompletions}
                  rowKey={(item) => `${item.userId}-${item.moduleNumber}-${item.completedAt}`}
                  columns={[
                    {
                      key: "learner",
                      header: "Learner",
                      required: true,
                      overflow: "wrap",
                      render: (item) => (
                        <Link to={`/admin/learners/${item.userId}`} className="aapm-link font-medium">{item.fullName || item.email}</Link>
                      ),
                    },
                    {
                      key: "module",
                      header: "Modul",
                      overflow: "wrap",
                      render: (item) => <div className="text-xs leading-5 text-muted-foreground">{item.moduleTitle || `Modul ${item.moduleNumber}`}</div>,
                    },
                    {
                      key: "completedAt",
                      header: "Selesai",
                      align: "right",
                      overflow: "nowrap",
                      render: (item) => <span className="text-xs text-muted-foreground">{formatAdminDate(item.completedAt)}</span>,
                    },
                  ]}
                />
              ) : (
                <StateView kind="empty" icon="modules" title="Belum ada penyelesaian" description="Penyelesaian modul yang tersimpan akan muncul di sini." framed={false} compact />
              )}
            </Surface>
          </div>
        </div>
      )}
    </AdminPageFrame>
  );
}
