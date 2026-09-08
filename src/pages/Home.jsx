import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import ContentContainer from "@/components/layout/ContentContainer";
import {
  ContinueLearning,
  DashboardWelcome,
  DashboardMetricStrip,
  LearningTracks,
  LearningProgressSummary,
  QuickToolGrid,
} from "@/components/academy/DashboardComponents";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useAuth } from "@/lib/AuthContext";
import { getNextModule, sortModules } from "@/lib/academyData";
import { useModules, useUserProgress } from "@/lib/useCourseData";

export default function Home() {
  const { user } = useAuth();
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
  const learningLoading = modulesLoading || progressLoading;
  const learningError = modulesError || progressError;
  const nextModule = getNextModule(modules, progress);
  const nextModules = nextModule ? sortModules(modules).filter((module) => module.moduleNumber > nextModule.moduleNumber).slice(0, 3) : [];
  const nextProgress = progress.find((item) => item.moduleNumber === nextModule?.moduleNumber);

  const retryLearningData = () => {
    refetchModules();
    refetchProgress();
  };

  return (
    <ContentContainer>
      <DashboardWelcome user={user} nextModule={nextModule} />
      <DashboardMetricStrip isLoading={learningLoading} modules={modules} progress={progress} nextModule={nextModule} />

      {learningError ? (
        <LearningErrorState
          title="Dashboard belum dapat memuat data"
          description="Progress dan roadmap belum berhasil diambil. Coba lagi untuk melanjutkan sesi belajar Anda."
          onRetry={retryLearningData}
        />
      ) : learningLoading ? (
        <LearningLoading label="Memuat dashboard belajar..." lines={2} />
      ) : !modules.length ? (
        <LearningEmptyState
          title="Jalur belajar sedang disiapkan"
          description="Belum ada modul yang tersedia untuk akun ini. Roadmap akan muncul di sini saat materi sudah dipublikasikan."
          actionLabel={null}
          actionTo={null}
        />
      ) : (
        <>
          <ContinueLearning module={nextModule} progress={nextProgress} />

          <LearningTracks modules={modules} progress={progress} />

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-5">
              <LearningProgressSummary modules={modules} progress={progress} />
              <Card className="bg-card/95">
                <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3"><CardTitle className="text-base">Berikutnya</CardTitle></CardHeader>
                <CardContent className="space-y-2 p-5 pt-2 sm:p-6 sm:pt-2">
                  {nextModules.length ? nextModules.map((module) => <Link key={module.id || module.moduleNumber} to={`/modules/${module.moduleNumber}`} className="group flex items-center gap-3 rounded-[var(--radius-control)] border border-border p-3 transition-colors hover:border-brand-green/35 hover:bg-brand-green/5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted text-xs font-semibold text-muted-foreground">{module.moduleNumber}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{module.title}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{module.category}</span><span>·</span><span className="inline-flex items-center gap-1"><AapmIcon name="clock" className="h-3 w-3" /> Lesson</span></div></div><AapmIcon name="chevronRight" className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>) : <div className="rounded-[var(--radius-control)] border border-dashed border-border p-5 text-sm text-muted-foreground">Selesaikan lesson berikutnya untuk membuka rekomendasi.</div>}
                  <Link to="/modules" className="inline-flex items-center gap-1.5 pt-2 text-xs font-semibold text-brand-green hover:underline"><AapmIcon name="course" className="h-3.5 w-3.5" /> Buka seluruh roadmap <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link>
                </CardContent>
              </Card>
            </div>
            <aside className="space-y-5"><QuickToolGrid /><Card className="border-tint-green-border bg-tint-green/65"><CardContent className="p-5"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint-green-foreground">Catatan belajar</div><p className="text-sm leading-6 text-foreground">Gunakan satu sesi untuk satu keputusan operasional. Catat insight yang bisa Anda bawa kembali ke farm.</p></CardContent></Card></aside>
          </div>
        </>
      )}
    </ContentContainer>
  );
}
