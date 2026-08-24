import React from "react";
import { Layers } from "lucide-react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import LearningRoadmap from "@/components/academy/LearningRoadmap";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useModules, useUserProgress } from "@/lib/useCourseData";

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

  const retryLearningData = () => {
    refetchModules();
    refetchProgress();
  };

  return (
    <ContentContainer>
      <PageHeader eyebrow="Learning path" title="Jalur pembelajaran" description="22 modul dalam 14 learning level. Ikuti status setiap modul dari current hingga completed." actions={<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><Layers className="h-3.5 w-3.5 text-brand-green" /> 22 modules · 14 levels</div>} />
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
      ) : <LearningRoadmap modules={modules} progress={progress} />}
    </ContentContainer>
  );
}
