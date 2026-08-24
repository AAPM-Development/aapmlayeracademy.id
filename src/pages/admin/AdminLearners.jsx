// @ts-nocheck
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { Badge, Input, Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives";
import { useAdminLearners } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

export default function AdminLearners() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useAdminLearners(search);
  const learners = data?.learners || [];

  return (
    <AdminPageFrame title="Learners" description="Daftar akun dan progres pembelajaran yang tersimpan di sistem native.">
      <div className="mb-5 flex max-w-md items-center gap-2 rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] px-3 shadow-[var(--surface-shadow)]"><Search className="h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email…" className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" aria-label="Cari learner" /></div>
      {isLoading ? <AdminLoading label="Memuat data learner…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !learners.length ? <AdminUnavailable title="Tidak ada learner ditemukan" description={search ? "Coba gunakan kata kunci lain." : "Belum ada data akun yang dapat ditampilkan."} /> : <Surface className="overflow-hidden p-0"><Table><TableHeader><TableRow><TableHead className="pl-5">Learner</TableHead><TableHead>Role</TableHead><TableHead>Progress</TableHead><TableHead>Sertifikat</TableHead><TableHead>Aktivitas terakhir</TableHead><TableHead className="pr-5 text-right">Detail</TableHead></TableRow></TableHeader><TableBody>{learners.map((learner) => <TableRow key={learner.id}><TableCell className="pl-5"><div className="font-semibold">{learner.full_name || learner.email}</div><div className="mt-0.5 text-xs text-muted-foreground">{learner.email}</div><div className="mt-1 text-[11px] text-muted-foreground">Terdaftar {formatAdminDate(learner.created_at)}</div></TableCell><TableCell><Badge variant="soft" className={learner.role === "admin" ? "bg-tint-orange text-tint-orange-foreground" : "bg-tint-green text-tint-green-foreground"}>{learner.role}</Badge></TableCell><TableCell><div className="min-w-[100px]"><div className="mb-1 flex justify-between gap-2 text-xs"><span>{learner.completedModules} modul</span><span>{learner.progressPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-green" style={{ width: `${learner.progressPercent}%` }} /></div></div></TableCell><TableCell className="tabular-nums">{learner.certificateCount}</TableCell><TableCell className="text-xs text-muted-foreground">{formatAdminDate(learner.lastActivity)}</TableCell><TableCell className="pr-5 text-right"><Link to={`/admin/learners/${learner.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Buka <ArrowRight className="h-3.5 w-3.5" /></Link></TableCell></TableRow>)}</TableBody></Table></Surface>}
    </AdminPageFrame>
  );
}
