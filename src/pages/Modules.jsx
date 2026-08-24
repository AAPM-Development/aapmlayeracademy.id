import React from "react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import LearningRoadmap from "@/components/academy/LearningRoadmap";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useModules, useUserProgress } from "@/lib/useCourseData";
import { getNextModule } from "@/lib/academyData";

export default function Modules() {
  const {
    data: modules = [],
    isLoading: modulesLoading,
    isError: modulesError,
    refetch: refetchModules,
  } = useModules();
  const {
    data: progress = [],
    isLoading: progressLoading,
    isError: progressError,
    refetch: refetchProgress,
  } = useUserProgress();
  const isLoading = modulesLoading || progressLoading;
  const isError = modulesError || progressError;
  const completedCount = progress.filter((item) => item.completed).length;
  const completion = modules.length
    ? Math.round((completedCount / modules.length) * 100)
    : 0;
  const nextModule = getNextModule(modules, progress);

  const retryLearningData = () => {
    refetchModules();
    refetchProgress();
  };

  return (
    <ContentContainer>
      <PageHeader eyebrow="Learning path" title="Jalur pembelajaran" description="Kuasai keputusan farm secara bertahap—dari fondasi flock sampai kepemimpinan operasional." actions={<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><AapmIcon name="modules" className="h-3.5 w-3.5 text-brand-orange" /> 22 modul · 14 level</div>} />
      {isError ? (
        <LearningErrorState
          title="Learning Path belum dapat dimuat"
          description="Roadmap atau progress Anda belum berhasil diambil. Coba lagi untuk melihat status lesson terbaru."
          onRetry={retryLearningData}
        />
      ) : isLoading ? (
        <LearningLoading label="Memuat learning path..." lines={4} />
      ) : !modules.length ? (
        <LearningEmptyState
          title="Learning Path sedang disiapkan"
          description="Belum ada modul yang tersedia untuk akun ini. Roadmap akan tampil saat materi sudah dipublikasikan."
          actionLabel={null}
          actionTo={null}
        />
      ) : (
        <>
          <section className="mb-6 overflow-hidden rounded-2xl border border-brand-orange/20 bg-background shadow-sm">
            <div className="h-1 bg-brand-orange" />
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[0.65fr_1.35fr] lg:items-center">
              <div className="flex items-end justify-between gap-4 lg:block">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Progress keseluruhan</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-foreground">{completion}%</p>
                </div>
                <p className="text-right text-xs text-muted-foreground lg:mt-1 lg:text-left">{completedCount} dari {modules.length} modul selesai</p>
              </div>
              <div className="min-w-0 rounded-xl bg-tint-orange px-4 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white">
                    <AapmIcon name="solar:play-circle-bold-duotone" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tint-orange-foreground/75">Berikutnya untuk Anda</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{nextModule?.title || "Semua modul telah diselesaikan"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{nextModule ? `Modul ${nextModule.moduleNumber} · ${nextModule.category}` : "Lanjutkan ke evaluasi dan sertifikasi."}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <LearningRoadmap modules={modules} progress={progress} />
        </>
      )}
    </ContentContainer>
  );
}
