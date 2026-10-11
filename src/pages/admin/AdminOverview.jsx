// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { DataTable, StateView } from "@/components/primitives";
import { useAdminCertificates, useAdminCourses, useAdminOverview } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { initialsOf } from "@/components/ProfileAvatar";
import PwaInstallNotice from "@/components/PwaInstallNotice";
import { Bar, Ic } from "@/design-system/canvas";

const AVATAR_HUES = ["green", "blue", "violet", "teal", "amber", "rose"];
const hueFor = (seed) => AVATAR_HUES[Math.abs(Number(seed) || String(seed).length) % AVATAR_HUES.length];

const lifecycleStatuses = [
  { key: "published", label: "Terbit" },
  { key: "unpublished", label: "Belum terbit", warn: true },
  { key: "draft", label: "Draf" },
  { key: "archived", label: "Arsip" },
];

function Metric({ hue, ic, label, value, unit, note, bar }) {
  return (
    <div className="card metric" data-hue={hue}>
      <span className="metric-label"><span className="tile tile-xs"><Ic name={ic} /></span>{label}</span>
      <span className="metric-value">{value}{unit ? <> <small>{unit}</small></> : null}</span>
      {bar !== undefined ? <Bar value={bar} size="sm" /> : <span className="metric-note">{note}</span>}
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, error, refetch } = useAdminOverview();
  const coursesQuery = useAdminCourses();
  const certificatesQuery = useAdminCertificates({ source: "verified", status: "issued" });
  const course = coursesQuery.data?.courses?.[0];
  const metric = (key) => data?.metrics?.find((item) => item.key === key)?.value;
  const learners = Number(metric("learners")) || 0;
  const active = Number(metric("active")) || 0;
  const completion = Number(metric("completion")) || 0;
  const activeShare = learners ? Math.round((active / learners) * 100) : 0;

  return (
    <AdminPageFrame
      title="Ringkasan"
      description="Pantau pembelajaran dari data native. Halaman ini hanya membaca dan tidak mengubah data produksi."
      actions={(
        <>
          <Link className="btn btn-secondary" to="/admin/learners"><Ic name="grad" />Lihat peserta</Link>
          <Link className="btn btn-primary" to="/admin/courses"><Ic name="edit" />Kelola kurikulum</Link>
        </>
      )}
    >
      <PwaInstallNotice />
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : (
        <>
          <section className="grid-sm" aria-label="Ringkasan administrasi">
            <Metric hue="green" ic="grad" label="Peserta terdaftar" value={metric("learners") ?? "—"} note="Akun non-admin" />
            <Metric hue="blue" ic="route" label="Aktif belajar" value={metric("active") ?? "—"} unit="peserta" note={`${activeShare}% memiliki progres tersimpan`} />
            <Metric hue="violet" ic="percent" label="Rata-rata penyelesaian" value={`${completion}%`} bar={completion} />
            <Metric hue="teal" ic="cert" label="Sertifikat terbit" value={certificatesQuery.isLoading ? "…" : certificatesQuery.data?.total ?? "—"} note="Terverifikasi server" />
          </section>

          <div className="split">
            <section className="card" aria-labelledby="done-title">
              <div className="card-pad card-head">
                <div className="stack gap-0-5"><h2 className="card-title" id="done-title">Penyelesaian terbaru</h2><p className="card-desc">Modul yang ditandai selesai oleh peserta.</p></div>
                <Link className="btn btn-ghost btn-sm" to="/admin/learners">Semua peserta<Ic name="chev-right" /></Link>
              </div>
              {data?.recentCompletions?.length ? (
                <DataTable
                  framed={false}
                  caption="Penyelesaian modul terbaru oleh peserta"
                  responsive="stacked"
                  rows={data.recentCompletions}
                  rowKey={(item) => `${item.userId}-${item.moduleNumber}-${item.completedAt}`}
                  columns={[
                    {
                      key: "learner",
                      header: "Peserta",
                      required: true,
                      render: (item) => (
                        <Link to={`/admin/learners/${item.userId}`} className="row gap-3">
                          <span className="avatar avatar-sm" data-hue={hueFor(item.userId)}>{initialsOf(item.fullName || item.email)}</span>
                          <span className="t-medium">{item.fullName || item.email}</span>
                        </Link>
                      ),
                    },
                    { key: "module", header: "Modul", render: (item) => <span className="t-clamp-1">Modul {item.moduleNumber}{item.moduleTitle ? ` · ${item.moduleTitle}` : ""}</span> },
                    { key: "completedAt", header: "Selesai", align: "right", render: (item) => <span className="t-muted">{formatAdminDate(item.completedAt)}</span> },
                  ]}
                />
              ) : (
                <StateView kind="empty" icon="modules" title="Belum ada penyelesaian" description="Penyelesaian modul yang tersimpan akan muncul di sini." framed={false} compact />
              )}
            </section>

            <aside className="stack gap-grid" aria-label="Status dan registrasi">
              <section className="card card-pad stack gap-4" aria-labelledby="content-title">
                <div className="card-head"><h2 className="card-title" id="content-title">Status konten</h2><Link className="btn btn-link t-support" to="/admin/courses">Kurikulum</Link></div>
                {coursesQuery.isLoading ? (
                  <div className="cgrid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>{lifecycleStatuses.map((item) => <span key={item.key} className="skel" style={{ height: 56 }} />)}</div>
                ) : coursesQuery.error ? (
                  <p className="t-support t-danger">Status kurikulum belum dapat dimuat. {coursesQuery.error.message}</p>
                ) : course ? (
                  <div className="cgrid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }} aria-label="Jumlah modul menurut status">
                    {lifecycleStatuses.map(({ key, label, warn }) => {
                      const count = course.lifecycleCounts?.[key] ?? 0;
                      return (
                        <div key={key} className="inset stack gap-0-5" style={{ padding: "10px 12px" }}>
                          <span className={`t-caption ${warn && count ? "t-warning" : "t-muted"}`}>{label}</span>
                          <span className="t-heading t-num">{course.lifecycleCounts?.[key] ?? "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="t-support t-muted">Status modul akan tampil setelah katalog tersedia.</p>
                )}
              </section>

              <section className="card" aria-labelledby="reg-title">
                <div className="card-pad card-head" style={{ paddingBottom: 8 }}><div className="stack gap-0-5"><h2 className="card-title" id="reg-title">Registrasi terbaru</h2><p className="card-desc">Akun peserta terakhir yang terdaftar.</p></div></div>
                {data?.recentRegistrations?.length ? (
                  <div className="list">
                    {data.recentRegistrations.slice(0, 5).map((user) => (
                      <Link key={user.id} className="li" to={`/admin/learners/${user.id}`}>
                        <span className="avatar avatar-sm" data-hue={hueFor(user.id)}>{initialsOf(user.full_name || user.email)}</span>
                        <div className="stack grow" style={{ minWidth: 0 }}><span className="li-title t-clamp-1">{user.full_name || user.email}</span><span className="li-meta t-clamp-1">{user.email}</span></div>
                        <span className="t-caption t-muted t-nowrap">{formatAdminDate(user.created_at, { year: undefined })}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="card-pad t-support t-muted" style={{ paddingTop: 0 }}>Registrasi peserta baru akan muncul di sini.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </AdminPageFrame>
  );
}
