// @ts-nocheck
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataTable, Input, Progress, Surface } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminLearners } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

export default function AdminLearners() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useAdminLearners(search);
  const learners = data?.learners || [];

  return (
    <AdminPageFrame title="Learners" description="Daftar akun dan progres pembelajaran yang tersimpan di sistem native.">
      <div className="mb-5 flex max-w-md items-center gap-2 rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] px-3 shadow-[var(--surface-shadow)]"><AapmIcon name="search" className="h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email…" className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" aria-label="Cari learner" /></div>
      {isLoading ? <AdminLoading label="Memuat data learner…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !learners.length ? <AdminUnavailable title="Tidak ada learner ditemukan" description={search ? "Coba gunakan kata kunci lain." : "Belum ada data akun yang dapat ditampilkan."} /> : <Surface className="p-0"><DataTable
        caption="Daftar learner dan progres pembelajaran"
        responsive="stacked"
        rows={learners}
        rowKey={(learner) => String(learner.id)}
        columns={[
          {
            key: "learner",
            header: "Learner",
            required: true,
            overflow: "wrap",
            render: (learner) => <div><div className="font-semibold">{learner.full_name || learner.email}</div><div className="mt-0.5 text-xs text-muted-foreground">{learner.email}</div><div className="mt-1 text-[11px] text-muted-foreground">Terdaftar {formatAdminDate(learner.created_at)}</div></div>,
          },
          {
            key: "role",
            header: "Role",
            overflow: "nowrap",
            render: (learner) => <Badge variant={learner.role === "admin" ? "warning" : "success"}>{learner.role}</Badge>,
          },
          {
            key: "progress",
            header: "Progress",
            overflow: "wrap",
            render: (learner) => <div className="min-w-32"><div className="mb-1 flex justify-between gap-2 text-xs"><span>{learner.completedModules} modul</span><span className="tabular-nums">{learner.progressPercent}%</span></div><Progress value={learner.progressPercent} aria-label={`Progress ${learner.progressPercent}%`} /></div>,
          },
          { key: "certificateCount", header: "Sertifikat", align: "right", overflow: "nowrap", render: (learner) => <span className="tabular-nums">{learner.certificateCount}</span> },
          { key: "lastActivity", header: "Aktivitas terakhir", overflow: "nowrap", render: (learner) => <span className="text-xs text-muted-foreground">{formatAdminDate(learner.lastActivity)}</span> },
          { key: "actions", header: "Detail", align: "right", required: true, overflow: "nowrap", render: (learner) => <Link to={`/admin/learners/${learner.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Buka <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link> },
        ]}
      /></Surface>}
    </AdminPageFrame>
  );
}
