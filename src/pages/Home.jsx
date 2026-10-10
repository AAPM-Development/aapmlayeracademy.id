import React, { useMemo } from "react";
import PwaInstallNotice from "@/components/PwaInstallNotice";
import { Page } from "@/design-system/patterns/AppShell";
import { StatTile } from "@/components/academy/CourseElements";
import { CertificationTeaser, DashboardHero, LevelProgressGrid, QuickTools, UpNextList } from "@/components/academy/DashboardComponents";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useAuth } from "@/lib/AuthContext";
import { getNextModule, getProgressSummary } from "@/lib/academyData";
import { buildCurriculum } from "@/lib/academyVisuals";
import { useCertificates, useModules, useUserProgress } from "@/lib/useCourseData";

/**
 * Learner home. Order follows what a learner needs: where am I and what is
 * next (hero), how am I doing (stats), where to go (levels, up next), and
 * the tools that apply what was learned.
 */
export default function Home() {
  const { user } = useAuth();
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const isLoading = modulesLoading || progressLoading;
  const isError = modulesError || progressError;

  const summary = getProgressSummary(modules, progress);
  const nextModule = getNextModule(modules, progress);
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const quizRows = progress.filter((item) => Number(item.quizTotal) > 0 && Number(item.moduleNumber) > 0);
  const quizAverage = quizRows.length
    ? Math.round(quizRows.reduce((sum, item) => sum + (Number(item.quizScore) || 0) / Number(item.quizTotal), 0) / quizRows.length * 100)
    : null;
  const activeLevel = curriculum.find((level) => level.hasCurrent) || curriculum[curriculum.length - 1];
  const upNext = curriculum.flatMap((level) => level.modules).filter((module) => module.state !== "completed" && module.moduleNumber !== nextModule?.moduleNumber).slice(0, 4);

  if (isError) {
    return (
      <Page>
        <LearningErrorState title="Beranda belum dapat memuat data" description="Progress dan kurikulum belum berhasil diambil." onRetry={() => { refetchModules(); refetchProgress(); }} />
      </Page>
    );
  }

  return (
    <Page>
      <PwaInstallNotice />
      {isLoading ? (
        <LearningLoading label="Memuat beranda belajar…" lines={3} />
      ) : !modules.length ? (
        <LearningEmptyState title="Jalur belajar sedang disiapkan" description="Kurikulum akan muncul di sini saat materi sudah dipublikasikan." actionLabel={null} actionTo={null} />
      ) : (
        <>
          <DashboardHero user={user} nextModule={nextModule} summary={summary} />

          <section className="aapm-stat-grid" aria-label="Ringkasan belajar">
            <StatTile icon="check" hue="green" label="Modul selesai" value={`${summary.completed}/${summary.total}`} />
            <StatTile icon="quiz" hue="blue" label="Rata-rata kuis" value={quizAverage === null ? "—" : `${quizAverage}%`} />
            <StatTile icon="roadmap" hue="orange" label="Level aktif" value={activeLevel ? activeLevel.name : "—"} />
            <StatTile icon="certificate" hue="violet" label="Sertifikat" value={certificates.length} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="grid min-w-0 content-start gap-6">
              <LevelProgressGrid curriculum={curriculum} />
              <UpNextList modules={upNext} />
            </div>
            <aside className="grid min-w-0 content-start gap-4" aria-label="Alat dan sertifikasi">
              <QuickTools />
              <CertificationTeaser certificates={certificates} summary={summary} />
            </aside>
          </div>
        </>
      )}
    </Page>
  );
}
