// @ts-nocheck
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, DataTable, Progress, SearchInput, Surface } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminLearners } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

function initialOf(learner) {
  return (learner.full_name || learner.email || "?").slice(0, 1).toUpperCase();
}

export default function AdminLearners() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useAdminLearners(search);
  const learners = data?.learners || [];

  return (
    <AdminPageFrame
      title="Peserta"
      description="Akun dan progres pembelajaran learner. Buka detail untuk melihat progres modul dan sertifikat."
    >
      <div className="aapm-toolbar mb-5">
        <SearchInput
          className="w-full sm:max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama atau email…"
          aria-label="Cari learner"
        />
        <span className="aapm-toolbar__spacer" />
        {!isLoading && !error ? (
          <Badge variant="soft">
            <AapmIcon name="users" />
            {learners.length} peserta
          </Badge>
        ) : null}
      </div>

      {isLoading ? (
        <AdminLoading label="Memuat data learner…" />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : !learners.length ? (
        <AdminUnavailable
          title="Tidak ada learner ditemukan"
          description={search ? "Coba gunakan kata kunci lain." : "Belum ada data akun yang dapat ditampilkan."}
        />
      ) : (
        <Surface className="p-0">
          <DataTable
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
                render: (learner) => (
                  <div className="aapm-user-cell">
                    <span className="aapm-initial-avatar" aria-hidden="true">{initialOf(learner)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{learner.full_name || learner.email}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{learner.email}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">Terdaftar {formatAdminDate(learner.created_at)}</span>
                    </span>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                overflow: "nowrap",
                render: (learner) => <Badge variant={learner.role === "admin" ? "warning" : "success"}>{learner.role === "admin" ? "Admin" : "Learner"}</Badge>,
              },
              {
                key: "progress",
                header: "Progress",
                overflow: "wrap",
                render: (learner) => (
                  <div className="aapm-user-progress">
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span>{learner.completedModules} modul</span>
                      <span className="tabular-nums">{learner.progressPercent}%</span>
                    </div>
                    <Progress value={learner.progressPercent} size="sm" aria-label={`Progress ${learner.progressPercent}%`} />
                  </div>
                ),
              },
              {
                key: "certificateCount",
                header: "Sertifikat",
                align: "right",
                overflow: "nowrap",
                render: (learner) => <span className="tabular-nums">{learner.certificateCount}</span>,
              },
              {
                key: "lastActivity",
                header: "Aktivitas",
                overflow: "nowrap",
                render: (learner) => <span className="text-xs text-muted-foreground">{formatAdminDate(learner.lastActivity)}</span>,
              },
              {
                key: "actions",
                header: "Detail",
                align: "right",
                required: true,
                overflow: "nowrap",
                render: (learner) => (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/admin/learners/${learner.id}`} aria-label={`Buka detail ${learner.full_name || learner.email}`}>
                      Buka
                      <AapmIcon name="arrowRight" />
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        </Surface>
      )}
    </AdminPageFrame>
  );
}
