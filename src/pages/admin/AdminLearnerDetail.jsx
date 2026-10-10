// @ts-nocheck
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, DataTable, KPICluster, Surface, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminLearner, useResetAdminUserProgress } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate, formatMinutes } from "@/components/admin/adminUtils";
import { useAuth } from "@/lib/AuthContext";

function initialOf(learner) {
  return (learner.full_name || learner.email || "?").slice(0, 1).toUpperCase();
}

export default function AdminLearnerDetail() {
  const { user: actor } = useAuth();
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
      const generation = result?.reset?.generationTo || 0;
      toast({
        title: "Progress direset",
        description: generation
          ? `Progress aktif dimulai ulang (siklus ${generation}). Riwayat ujian, sertifikat, data farm, dan percakapan tetap tersimpan.`
          : "Progress aktif dimulai ulang. Riwayat tetap tersimpan.",
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
    <AdminPageFrame
      back={{ to: "/admin/learners", label: "Peserta" }}
      title="Detail peserta"
      description="Progres modul, nilai kuis, dan sertifikat learner ini."
      actions={learner && actor?.canManageUsers ? (
        <Button type="button" variant="danger-soft" onClick={() => setResetConfirmationOpen(true)} disabled={resetProgress.isPending}>
          <AapmIcon name="refresh" />
          {resetProgress.isPending ? "Mereset…" : "Reset progress"}
        </Button>
      ) : null}
    >
      {isLoading ? (
        <AdminLoading label="Memuat detail peserta…" />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : (
        <div className="aapm-admin-stack">
          <Surface tone="green" className="aapm-learner-hero">
            <div className="aapm-learner-hero__identity">
              <span className="aapm-initial-avatar" data-size="lg" aria-hidden="true">{initialOf(learner)}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="aapm-learner-hero__name">{learner.full_name || learner.email}</h2>
                  <Badge variant="soft" hue="green">{learner.role === "admin" ? "Admin" : "Learner"}</Badge>
                </div>
                <p className="aapm-learner-hero__meta">Terdaftar {formatAdminDate(learner.created_at)}</p>
              </div>
            </div>
            <dl className="aapm-learner-hero__stats">
              <div>
                <dt>Modul selesai</dt>
                <dd>{learner.completedModules}</dd>
              </div>
              <div>
                <dt>Progress</dt>
                <dd>{learner.progressPercent}%</dd>
              </div>
              <div>
                <dt>Waktu belajar</dt>
                <dd>{formatMinutes(learner.timeSpentMinutes)}</dd>
              </div>
            </dl>
          </Surface>

          <Tabs defaultValue="overview">
            <TabsList variant="underline" aria-label="Bagian detail peserta">
              <TabsTrigger value="overview">Ringkasan</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="certificates">Sertifikat</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-5">
              <Surface className="p-5 sm:p-6">
                <h2 className="text-sm font-semibold">Data yang tersedia</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.availabilityNote}</p>
                <KPICluster
                  className="mt-5"
                  columns={3}
                  variant="cards"
                  items={[
                    { label: "Modul selesai", value: `${learner.completedModules} modul`, icon: "check", tone: "success", colorway: 1, emphasis: "solid", note: "Progress selesai" },
                    { label: "Waktu tercatat", value: formatMinutes(learner.timeSpentMinutes), icon: "clock", tone: "info", colorway: 2, emphasis: "solid", note: "Aktivitas belajar" },
                    { label: "Sertifikat", value: data.certificates?.length || 0, icon: "fileCheck", tone: "warning", colorway: 3, emphasis: "solid", note: "Diterbitkan" },
                  ]}
                />
              </Surface>
            </TabsContent>

            <TabsContent value="progress" className="mt-5">
              {data.progress?.length ? (
                <Surface className="p-0">
                  <DataTable
                    caption="Progress modul peserta"
                    responsive="stacked"
                    rows={data.progress}
                    rowKey={(item) => String(item.moduleNumber)}
                    columns={[
                      {
                        key: "module",
                        header: "Modul",
                        required: true,
                        overflow: "wrap",
                        render: (item) => (
                          <div>
                            <div className="font-medium">{item.moduleTitle}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Modul {item.moduleNumber}{item.levelName ? ` · ${item.levelName}` : ""}</div>
                          </div>
                        ),
                      },
                      {
                        key: "status",
                        header: "Status",
                        overflow: "nowrap",
                        render: (item) => <Badge variant={item.completed ? "success" : "warning"}>{item.completed ? "Selesai" : "Berjalan"}</Badge>,
                      },
                      {
                        key: "quiz",
                        header: "Nilai kuis",
                        align: "right",
                        overflow: "nowrap",
                        render: (item) => <span className="tabular-nums">{item.quizTotal ? `${item.quizScore || 0}/${item.quizTotal}` : "—"}</span>,
                      },
                      {
                        key: "practical",
                        header: "Praktik",
                        overflow: "nowrap",
                        render: (item) => (item.practicalDone ? <Badge variant="success">Selesai</Badge> : <span className="text-muted-foreground">—</span>),
                      },
                      {
                        key: "updatedAt",
                        header: "Pembaruan",
                        align: "right",
                        overflow: "nowrap",
                        render: (item) => <span className="text-xs text-muted-foreground">{formatAdminDate(item.updatedAt)}</span>,
                      },
                    ]}
                  />
                </Surface>
              ) : (
                <AdminUnavailable title="Belum ada progres tersimpan" description="Progress modul akan muncul ketika learner menyimpan aktivitas belajar." />
              )}
            </TabsContent>

            <TabsContent value="certificates" className="mt-5">
              {data.certificates?.length ? (
                <div className="aapm-certificate-grid">
                  {data.certificates.map((certificate) => (
                    <Surface key={certificate.id} tone="orange" className="aapm-certificate-card">
                      <AapmIcon name="award" className="aapm-certificate-card__icon" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{certificate.levelName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{certificate.examType} · nilai {certificate.score}</div>
                        <div className="mt-3 text-xs text-muted-foreground">Diterbitkan {formatAdminDate(certificate.issuedAt)}</div>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : (
                <AdminUnavailable title="Belum ada sertifikat" description="Sertifikat akan muncul setelah diterbitkan melalui alur pembelajaran yang tersedia." />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
      <ConfirmDialog
        open={resetConfirmationOpen}
        onOpenChange={setResetConfirmationOpen}
        title="Reset progress peserta?"
        description={`Seluruh progress belajar ${learner?.full_name || learner?.email || "peserta ini"} akan dimulai ulang: status modul, kuis, praktik, dan waktu belajar aktif kembali kosong. Riwayat ujian dan nilai lama, sertifikat, data farm, dan percakapan tetap tersimpan.`}
        confirmLabel="Reset progress"
        icon="solar:restart-bold"
        destructive
        onConfirm={confirmResetProgress}
      />
    </AdminPageFrame>
  );
}
