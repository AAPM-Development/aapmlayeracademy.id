import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Lightbulb, PlayCircle, Target } from "lucide-react";
import { Card, CardContent, useToast } from "@/components/primitives";
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
import { useParams } from "react-router-dom";

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

  useEffect(() => {
    if (!module) return undefined;
    const sectionElements = lessonSections.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!sectionElements.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -62%", threshold: [0, 0.2] });

    sectionElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [module?.moduleNumber]);

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
  if (!module) return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><LearningEmptyState title="Modul belum tersedia" description="Lesson ini belum tersedia atau tautannya sudah berubah. Kembali ke Learning Path untuk memilih materi lain." actionLabel="Kembali ke Learning Path" actionTo="/modules" /></div>;

  return (
    <LearningFocusShell
      header={<LessonHeader module={module} completed={moduleProgress?.completed} />}
      sidebar={<LessonSidebar module={module} activeSection={activeSection} onSectionChange={jumpToSection} />}
      footer={<div className="mt-8 lg:pr-[292px]">{saveProgress.isError && <div className="mb-4 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger" role="alert">Progress belum tersimpan. Silakan coba tombol selesai lagi.</div>}<LessonNavigation previous={previous} next={next} onComplete={markComplete} completed={Boolean(moduleProgress?.completed)} saving={saveProgress.isPending} /></div>}
    >
      <div className="space-y-10">
        <LessonSection id="content" title="Materi" icon={FileText}>
          <div className="markdown-body"><ReactMarkdown>{module.content || "Konten modul sedang disiapkan."}</ReactMarkdown></div>
        </LessonSection>

        <LessonSection id="video" title="Video lesson" icon={PlayCircle}>
          <LessonMedia module={module} />
          <Card className="mt-4 bg-surface-subtle shadow-none"><CardContent className="p-4 text-sm leading-6 text-muted-foreground"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Script instruktur</div>{module.videoScript || "Script video sedang disiapkan."}</CardContent></Card>
        </LessonSection>

        <LessonSection id="objectives" title="Tujuan & insight" icon={Target}>
          <div className="grid gap-6 sm:grid-cols-2"><div><div className="mb-3 text-sm font-semibold">Tujuan pembelajaran</div><LessonInsightList items={module.learningObjectives || []} icon={Target} /></div><div><div className="mb-3 text-sm font-semibold"><Lightbulb className="mr-1 inline h-4 w-4 text-brand-orange" /> Key takeaways</div><LessonInsightList items={module.keyTakeaways || []} /></div></div>
        </LessonSection>

        <LessonSection id="practical" title="Praktik" icon={Target}>
          <Card className="border-brand-green/20 bg-brand-green/5 shadow-none"><CardContent className="p-5"><div className="mb-3 text-sm font-semibold">Practical assignment</div><p className="text-sm leading-6 text-muted-foreground">{module.practicalAssignment || "Tugas praktik untuk modul ini akan ditampilkan di sini."}</p>{module.checklist?.length > 0 && <div className="mt-5 border-t border-brand-green/15 pt-5"><div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-green">Checklist observasi</div><LessonChecklist items={module.checklist} /></div>}</CardContent></Card>
        </LessonSection>
      </div>
    </LearningFocusShell>
  );
}
