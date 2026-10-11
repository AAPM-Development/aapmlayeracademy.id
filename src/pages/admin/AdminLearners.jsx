// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, StateView } from "@/components/primitives";
import { useAdminLearners } from "@/lib/useAdminData";
import { AdminError, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { initialsOf } from "@/components/ProfileAvatar";
import { Bar, Ic } from "@/design-system/canvas";

const PAGE_SIZE = 10;
const AVATAR_HUES = ["green", "blue", "violet", "teal", "amber", "rose"];
const TIER_HUES = ["green", "teal", "blue", "violet", "rose", "gold"];

const STATUS_FILTERS = {
  all: () => true,
  active: (learner) => learner.completedModules > 0 && learner.progressPercent < 100,
  new: (learner) => !learner.progressEntries,
  done: (learner) => learner.progressPercent >= 100,
};
const SORTS = {
  activity: (a, b) => String(b.lastActivity || "").localeCompare(String(a.lastActivity || "")),
  progress: (a, b) => b.progressPercent - a.progressPercent,
  name: (a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "id"),
};

export default function AdminLearners() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("activity");
  const [page, setPage] = useState(0);
  const { data, isLoading, error, refetch } = useAdminLearners(search);
  const learners = data?.learners || [];

  const rows = useMemo(() => learners.filter(STATUS_FILTERS[status]).sort(SORTS[sort]), [learners, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => setPage(0), [search, status, sort]);
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <AdminPageFrame title="Peserta" description="Akun dan progres pembelajaran peserta. Buka detail untuk melihat progres modul dan sertifikat.">
      {error ? <AdminError error={error} onRetry={refetch} /> : (
        <section className="card anim-rise" aria-labelledby="list-title">
          <h2 className="sr-only" id="list-title">Daftar peserta</h2>
          <div className="toolbar" style={{ padding: "12px var(--card-pad)" }}>
            <label className="search" style={{ flex: "1 1 260px", maxWidth: 360 }}>
              <Ic name="search" size="sm" /><span className="sr-only">Cari peserta</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email…" />
            </label>
            <label className="sr-only" htmlFor="f-status">Status belajar</label>
            <select className="select" id="f-status" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Semua status</option><option value="active">Aktif belajar</option><option value="new">Belum mulai</option><option value="done">Selesai</option>
            </select>
            <label className="sr-only" htmlFor="f-sort">Urutan</label>
            <select className="select" id="f-sort" style={{ width: "auto" }} value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="activity">Urutkan: Aktivitas terbaru</option><option value="progress">Urutkan: Progres tertinggi</option><option value="name">Urutkan: Nama A–Z</option>
            </select>
            {/* The count is hidden while loading: never a temporary "0 peserta". */}
            {!isLoading ? <span className="t-support t-muted t-num ml-auto" aria-live="polite">{rows.length} peserta</span> : null}
          </div>
          {!isLoading && !rows.length ? (
            <div className="card-sect">
              <StateView
                kind="empty"
                icon="users"
                compact
                framed={false}
                title={search || status !== "all" ? "Tidak ada hasil" : "Belum ada peserta"}
                description={search || status !== "all" ? "Coba kata kunci atau filter lain." : "Peserta muncul setelah akun dibuat dari menu Pengguna."}
                action={search || status !== "all" ? null : <Link className="btn btn-secondary btn-sm" to="/admin/users">Buka Pengguna</Link>}
              />
            </div>
          ) : (
            <DataTable
              framed={false}
              className="card-sect"
              caption="Daftar peserta dan progres pembelajaran"
              responsive="stacked"
              loading={isLoading}
              rows={visible}
              rowKey={(learner) => String(learner.id)}
              sort={{ key: "lastActivity", direction: sort === "activity" ? "desc" : null }}
              columns={[
                {
                  key: "learner", header: "Peserta", required: true,
                  render: (learner, index) => (
                    <Link to={`/admin/learners/${learner.id}`} className="row gap-3">
                      <span className="avatar avatar-sm" data-hue={AVATAR_HUES[(Number(learner.id) || index) % AVATAR_HUES.length]}>{initialsOf(learner.full_name || learner.email)}</span>
                      <span className="stack" style={{ minWidth: 0 }}><span className="t-medium t-clamp-1">{learner.full_name || learner.email}</span><span className="t-caption t-muted t-clamp-1">{learner.email}</span></span>
                    </Link>
                  ),
                },
                {
                  key: "progress", header: "Progres",
                  render: (learner) => (
                    <div className="row gap-3">
                      <Bar value={learner.progressPercent} size="sm" style={{ width: 96 }} />
                      <span className={`t-support t-num t-nowrap${learner.completedModules ? "" : " t-muted"}`}>
                        {learner.completedModules}/{learner.moduleTotal ?? "—"} · {learner.completedModules ? `${learner.progressPercent}%` : "Belum mulai"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "quiz", header: "Rata-rata kuis", align: "right",
                  render: (learner) => (learner.quizAverage === null || learner.quizAverage === undefined
                    ? <span className="t-muted"><span aria-hidden="true">—</span><span className="sr-only">Belum ada nilai</span></span>
                    : `${learner.quizAverage}%`),
                },
                {
                  key: "certificates", header: "Sertifikat",
                  render: (learner) => (learner.certificateTiers?.length ? (
                    <div className="row gap-2">
                      {learner.certificateTiers.map((tier) => <span key={tier} className="medal medal-sm" data-hue={TIER_HUES[(tier - 1) % 6]} style={{ width: 24, height: 24 }} role="img" aria-label={`Tingkat ${tier}`}>{tier}</span>)}
                    </div>
                  ) : <span className="t-muted"><span aria-hidden="true">—</span><span className="sr-only">Belum ada sertifikat</span></span>),
                },
                { key: "lastActivity", header: "Aktivitas terakhir", sortable: true, render: (learner) => <span className="t-muted t-nowrap">{formatAdminDate(learner.lastActivity)}</span> },
                {
                  key: "actions", header: <span className="sr-only">Tindakan</span>, align: "end", required: true,
                  render: (learner) => (
                    <div className="row gap-1 justify-end">
                      <Link className="btn btn-secondary btn-sm" to={`/admin/learners/${learner.id}`} aria-label={`Buka detail ${learner.full_name || learner.email}`}>Buka</Link>
                    </div>
                  ),
                },
              ]}
              onSort={() => setSort(sort === "activity" ? "name" : "activity")}
            />
          )}
          {!isLoading && rows.length ? (
            <nav className="card-foot between" aria-label="Halaman daftar peserta">
              <span className="t-support t-muted t-num">{current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} dari {rows.length}</span>
              <div className="row gap-3">
                <span className="t-support t-muted t-num hide-sm">Halaman {current + 1} dari {pages}</span>
                <div className="row gap-2">
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={current === 0} aria-label="Halaman sebelumnya" onClick={() => setPage(current - 1)}><Ic name="chev-left" /></button>
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={current >= pages - 1} aria-label="Halaman berikutnya" onClick={() => setPage(current + 1)}><Ic name="chev-right" /></button>
                </div>
              </div>
            </nav>
          ) : null}
        </section>
      )}
    </AdminPageFrame>
  );
}
