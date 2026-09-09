// @ts-nocheck
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, DataTable, KPICluster, Surface, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminLearner, useResetAdminUserProgress } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate, formatMinutes } from "@/components/admin/adminUtils";

export default function AdminLearnerDetail() {
  const { learnerId } = useParams();
  const { data, isLoading, error, refetch } = useAdminLearner(learnerId);
  const learner = data?.learner;
  const resetProgress = useResetAdminUserProgress();
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const { toast } = useToast();

  const confirmResetProgress = async () => {
    setResetConfirmationOpen(false);
    if (!learner) return;
    try {
      const result = await resetProgress.mutateAsync({ userId: learner.id });
      const deletedEntries = result?.reset?.deletedEntries || 0;
      toast({
        title: "Progress direset",
        description: deletedEntries
          ? `${deletedEntries} entri progress dihapus. Sertifikat, data farm, dan percakapan tetap ada.`
          : "Belum ada entri progress. Data akun lain tetap ada.",
      });
    } catch (resetError) {
      toast({
        variant: "destructive",
        title: "Progress belum direset",
        description: resetError.message,
      });
    }
  };

  return (
    <AdminPageFrame title={learner?.full_name || learner?.email || "Detail peserta"} description={learner?.email} actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/learners"><AapmIcon name="arrowLeft" className="h-4 w-4" /> Semua peserta</Link></Button>{learner && <Button type="button" variant="outline" className="border-danger/25 text-danger hover:border-danger/45 hover:bg-danger/5" onClick={() => setResetConfirmationOpen(true)} disabled={resetProgress.isPending}><AapmIcon name="refresh" /> Reset progress</Button>}</div>}>
      {isLoading ? <AdminLoading label="Memuat detail peserta…" /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5"><Surface tone="green" className="p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{learner.full_name || learner.email}</h2><Badge variant="soft" className="bg-white/70 text-tint-green-foreground">{learner.role}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Terdaftar {formatAdminDate(learner.created_at)}</p></div><div className="grid grid-cols-3 gap-5 text-right"><div><div className="text-xl font-semibold">{learner.completedModules}</div><div className="text-[11px] text-muted-foreground">Modul selesai</div></div><div><div className="text-xl font-semibold">{learner.progressPercent}%</div><div className="text-[11px] text-muted-foreground">Progress</div></div><div><div className="text-xl font-semibold">{formatMinutes(learner.timeSpentMinutes)}</div><div className="text-[11px] text-muted-foreground">Waktu belajar</div></div></div></div></Surface><Tabs defaultValue="overview"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Ringkasan</TabsTrigger><TabsTrigger value="progress">Progress</TabsTrigger><TabsTrigger value="certificates">Sertifikat</TabsTrigger></TabsList><TabsContent value="overview" className="mt-4"><Surface className="p-5"><h2 className="text-sm font-semibold">Data yang tersedia</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{data.availabilityNote}</p><KPICluster className="mt-5" columns={3} variant="cards" items={[{ label: "Modul selesai", value: `${learner.completedModules} modul`, icon: "check", tone: "success", colorway: 1, emphasis: "solid", note: "Progress selesai" }, { label: "Waktu tercatat", value: formatMinutes(learner.timeSpentMinutes), icon: "clock", tone: "info", colorway: 2, emphasis: "solid", note: "Aktivitas belajar" }, { label: "Sertifikat", value: data.certificates?.length || 0, icon: "fileCheck", tone: "warning", colorway: 3, emphasis: "solid", note: "Diterbitkan" }]} /></Surface></TabsContent><TabsContent value="progress" className="mt-4">{data.progress?.length ? <Surface className="p-0"><DataTable caption="Progress modul peserta" responsive="stacked" rows={data.progress} rowKey={(item) => String(item.moduleNumber)} columns={[{ key: "module", header: "Modul", required: true, overflow: "wrap", render: (item) => <div className="font-medium"><div>{item.moduleTitle}</div><div className="mt-0.5 text-xs text-muted-foreground">Modul {item.moduleNumber}{item.levelName ? ` · ${item.levelName}` : ""}</div></div> }, { key: "status", header: "Status", overflow: "nowrap", render: (item) => <Badge variant={item.completed ? "success" : "warning"}>{item.completed ? "Selesai" : "Berjalan"}</Badge> }, { key: "quiz", header: "Nilai kuis", align: "right", overflow: "nowrap", render: (item) => <span className="tabular-nums">{item.quizTotal ? `${item.quizScore || 0}/${item.quizTotal}` : "—"}</span> }, { key: "practical", header: "Praktik", overflow: "nowrap", render: (item) => item.practicalDone ? <Badge variant="success">Selesai</Badge> : <span className="text-muted-foreground">—</span> }, { key: "updatedAt", header: "Pembaruan", align: "right", overflow: "nowrap", render: (item) => <span className="text-xs text-muted-foreground">{formatAdminDate(item.updatedAt)}</span> }]} /></Surface> : <AdminUnavailable title="Belum ada progres tersimpan" description="Progress modul akan muncul ketika learner menyimpan aktivitas belajar." />}</TabsContent><TabsContent value="certificates" className="mt-4">{data.certificates?.length ? <div className="grid gap-3 sm:grid-cols-2">{data.certificates.map((certificate) => <Surface key={certificate.id} tone="orange" className="p-4"><div className="text-sm font-semibold">{certificate.levelName}</div><div className="mt-1 text-xs text-muted-foreground">{certificate.examType} · nilai {certificate.score}</div><div className="mt-3 text-xs text-muted-foreground">Diterbitkan {formatAdminDate(certificate.issuedAt)}</div></Surface>)}</div> : <AdminUnavailable title="Belum ada sertifikat" description="Sertifikat akan muncul setelah diterbitkan melalui alur pembelajaran yang tersedia." />}</TabsContent></Tabs></div>}
      <ConfirmDialog open={resetConfirmationOpen} onOpenChange={setResetConfirmationOpen} title="Reset progress peserta?" description={`Seluruh progress belajar ${learner?.full_name || learner?.email || "peserta ini"} akan dihapus permanen: status modul, nilai kuis, praktik, dan waktu belajar. Sertifikat, data farm, dan percakapan tetap dipertahankan.`} confirmLabel="Reset progress" icon="solar:restart-bold" destructive onConfirm={confirmResetProgress} />
    </AdminPageFrame>
  );
}
