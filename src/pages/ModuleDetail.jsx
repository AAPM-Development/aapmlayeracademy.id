import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent } from "@/components/academy/EditorialContent";
import LearningFocusShell from "@/components/layout/LearningFocusShell";
import {
  LessonChecklist,
  LessonHeader,
  LessonInsightList,
  LessonMedia,
  LessonNavigation,
  LessonSection,
  LessonSidebar,
  lessonSections,
} from "@/components/academy/LessonWorkspace";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useModules, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";
import { editorialLearnerNavigationItems, hasEditorialVideo } from "@/lib/editorialDocument";
import { useParams } from "react-router-dom";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasListContent = (value) => Array.isArray(value)
  ? value.some((item) => hasText(String(item || "")))
  : hasText(value);

export default function ModuleDetail() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const { toast } = useToast();
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
  const saveProgress = useSaveProgress();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const [activeSection, setActiveSection] = useState("content");
  const isLoading = modulesLoading || progressLoading;

  const sortedModules = useMemo(() => sortModules(modules), [modules]);
  const module = sortedModules.find((item) => item.moduleNumber === number);
  const moduleProgress = progress.find((item) => item.moduleNumber === number);
  const index = sortedModules.findIndex((item) => item.moduleNumber === number);
  const previous = index > 0 ? sortedModules[index - 1] : null;
  const next = index >= 0 ? sortedModules[index + 1] || null : null;
  const editorialVideoIsPresent = useMemo(() => hasEditorialVideo(module?.editorialContent), [module?.editorialContent]);
  const editorialNavigationItems = useMemo(() => editorialLearnerNavigationItems(module?.editorialContent), [module?.editorialContent]);
  const legacyVideoIsPresent = useMemo(() => [
    module?.videoUrl,
    module?.videoEmbedUrl,
    module?.video,
    module?.videoScript,
  ].some(hasText), [module?.videoUrl, module?.videoEmbedUrl, module?.video, module?.videoScript]);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  const learnerSections = useMemo(() => {
    const visibleSections = lessonSections.filter((section) => {
    if (section.id === "video") return !editorialVideoIsPresent && legacyVideoIsPresent;
    if (section.id === "objectives") return objectivesArePresent;
    if (section.id === "practical") return practiceIsPresent;
    return true;
    });
    const [contentSection, ...remainingSections] = visibleSections;
    return [contentSection, ...editorialNavigationItems, ...remainingSections].filter(Boolean);
  }, [editorialNavigationItems, editorialVideoIsPresent, legacyVideoIsPresent, objectivesArePresent, practiceIsPresent]);

  useEffect(() => {
    if (!module) return undefined;
    const sectionElements = learnerSections.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!sectionElements.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -62%", threshold: [0, 0.2] });

    sectionElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [module?.moduleNumber, learnerSections]);

  const markComplete = async () => {
    if (!module || moduleProgress?.completed) return;
    try {
      await save({ moduleNumber: number, data: { moduleNumber: number, completed: true } });
      toast({ title: "Modul diselesaikan", description: "Progress Anda sudah tersimpan." });
    } catch {
      toast({ title: "Progress belum tersimpan", description: "Coba lagi setelah koneksi kembali normal.", variant: "destructive" });
    }
  };

  const jumpToSection = (section) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (modulesError || progressError) return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><LearningErrorState title="Lesson belum dapat dimuat" description="Materi atau progress Anda belum berhasil diambil. Coba lagi untuk membuka lesson ini." onRetry={() => { refetchModules(); refetchProgress(); }} /></div>;
  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><LearningLoading label="Memuat lesson..." lines={1} /></div>;
  if (!module) return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><LearningEmptyState title="Modul belum tersedia" description="Materi ini belum tersedia atau tautannya sudah berubah. Kembali ke jalur belajar untuk memilih materi lain." actionLabel="Kembali ke jalur belajar" actionTo="/modules" /></div>;

  return (
    <LearningFocusShell
      header={<LessonHeader module={module} completed={moduleProgress?.completed} />}
      sidebar={<LessonSidebar module={module} activeSection={activeSection} onSectionChange={jumpToSection} sections={learnerSections} />}
      footer={<div className="mt-8 lg:pr-[292px]">{saveProgress.isError && <div className="mb-4 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger" role="alert">Progress belum tersimpan. Silakan coba tombol selesai lagi.</div>}<LessonNavigation previous={previous} next={next} onComplete={markComplete} completed={Boolean(moduleProgress?.completed)} saving={saveProgress.isPending} /></div>}
    >
      <div className="space-y-10">
        <LessonSection id="content" title="Materi" icon="solar:file-text-bold">
          <EditorialContent
            document={module.editorialContent}
            fallback={module.content}
            title={module.title}
          />
        </LessonSection>

        {!editorialVideoIsPresent && legacyVideoIsPresent && (
          <LessonSection id="video" title="Video materi" icon="solar:play-circle-bold">
            <LessonMedia module={module} />
            {hasText(module.videoScript) && <Card className="mt-4 bg-surface-subtle shadow-none"><CardContent className="p-4 text-sm leading-6 text-muted-foreground"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Catatan instruktur</div>{module.videoScript}</CardContent></Card>}
          </LessonSection>
        )}

        {objectivesArePresent && <LessonSection id="objectives" title="Tujuan & insight" icon="solar:target-bold-duotone">
          <div className="grid gap-6 sm:grid-cols-2">
            {hasListContent(module.learningObjectives) && <div><div className="mb-3 text-sm font-semibold">Tujuan pembelajaran</div><LessonInsightList items={module.learningObjectives || []} icon="solar:target-bold-duotone" /></div>}
            {hasListContent(module.keyTakeaways) && <div><div className="mb-3 text-sm font-semibold"><AapmIcon name="solar:lightbulb-bolt-bold-duotone" className="mr-1 inline h-4 w-4 text-brand-orange" /> Inti pembelajaran</div><LessonInsightList items={module.keyTakeaways || []} /></div>}
          </div>
        </LessonSection>}

        {practiceIsPresent && <LessonSection id="practical" title="Praktik" icon="solar:clipboard-check-bold-duotone">
          <Card className="border-brand-green/20 bg-brand-green/5 shadow-none"><CardContent className="p-5">
            {hasText(module.practicalAssignment) && <><div className="mb-3 text-sm font-semibold">Tugas praktik</div><p className="text-sm leading-6 text-muted-foreground">{module.practicalAssignment}</p></>}
            {hasListContent(module.checklist) && <div className={hasText(module.practicalAssignment) ? "mt-5 border-t border-brand-green/15 pt-5" : ""}><div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-green">Checklist observasi</div><LessonChecklist items={module.checklist} /></div>}
          </CardContent></Card>
        </LessonSection>}
      </div>
    </LearningFocusShell>
  );
}
