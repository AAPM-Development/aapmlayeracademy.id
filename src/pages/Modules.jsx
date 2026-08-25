import React from "react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconTile, Surface } from "@/components/primitives";
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
          <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <Surface tone="orange" className="relative overflow-hidden p-5 sm:p-6"><div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-brand-orange/10" /><div className="relative"><Badge variant="soft" className="bg-background/80 text-[10px] uppercase tracking-[0.14em] text-tint-orange-foreground">Learning path</Badge><div className="mt-4 flex items-end gap-3"><div className="text-4xl font-semibold tracking-[-0.06em]">{completion}%</div><div className="pb-1 text-xs text-muted-foreground">{completedCount}/{modules.length} modul</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-brand-orange transition-[width] duration-500" style={{ width: `${completion}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Progress dihitung dari modul yang tersimpan selesai di akun Anda.</p></div></Surface>
            <Surface className="flex min-w-0 flex-col justify-between p-5 sm:p-6"><div className="flex min-w-0 items-start gap-3"><IconTile icon="solar:play-circle-bold-duotone" tone="orange" size="lg" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-orange">Berikutnya untuk Anda</p><p className="mt-1 truncate text-lg font-semibold">{nextModule?.title || "Semua modul telah diselesaikan"}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{nextModule ? `Modul ${nextModule.moduleNumber} · ${nextModule.category}` : "Lanjutkan ke evaluasi dan sertifikasi."}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs"><span className="text-muted-foreground">Roadmap tertata per level</span><span className="inline-flex items-center gap-1 font-semibold text-brand-green"><AapmIcon name="checkRead" className="h-3.5 w-3.5" /> Accordion default tertutup</span></div></Surface>
          </section>
          <LearningRoadmap modules={modules} progress={progress} />
        </>
      )}
    </ContentContainer>
  );
}
