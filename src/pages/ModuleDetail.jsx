import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Lightbulb, PlayCircle, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LearningFocusShell from "@/components/layout/LearningFocusShell";
import {
  LessonChecklist,
  LessonHeader,
  LessonInsightList,
  LessonNavigation,
  LessonSection,
  LessonSidebar,
} from "@/components/academy/LessonWorkspace";
import { Skeleton } from "@/components/ui/skeleton";
import { useModules, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";
import { Link, useParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export default function ModuleDetail() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const { toast } = useToast();
  const { data: modules = [], isLoading } = useModules();
  const { data: progress = [] } = useUserProgress();
  const saveProgress = useSaveProgress();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const [activeSection, setActiveSection] = useState("content");

  const sortedModules = useMemo(() => sortModules(modules), [modules]);
  const module = sortedModules.find((item) => item.moduleNumber === number);
  const moduleProgress = progress.find((item) => item.moduleNumber === number);
  const index = sortedModules.findIndex((item) => item.moduleNumber === number);
  const previous = index > 0 ? sortedModules[index - 1] : null;
  const next = index >= 0 ? sortedModules[index + 1] || null : null;

  const markComplete = async () => {
    if (!module || moduleProgress?.completed) return;
    await save({ moduleNumber: number, data: { moduleNumber: number, completed: true } });
    toast({ title: "Modul diselesaikan", description: "Progress Anda sudah tersimpan." });
  };

  const jumpToSection = (section) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) return <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-5 w-full max-w-2xl" /><Skeleton className="h-48 w-full" /></div>;
  if (!module) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground sm:px-6">Modul belum tersedia. Kembali ke <Link className="font-semibold text-brand-green hover:underline" to="/modules">Learning Path</Link>.</div>;

  return (
    <LearningFocusShell
      header={<LessonHeader module={module} completed={moduleProgress?.completed} />}
      sidebar={<LessonSidebar module={module} activeSection={activeSection} onSectionChange={jumpToSection} />}
      footer={<div className="mt-8 lg:pr-[292px]"><LessonNavigation previous={previous} next={next} onComplete={markComplete} completeDisabled={moduleProgress?.completed || saveProgress.isPending} /></div>}
    >
      <div className="space-y-10">
        <LessonSection id="content" title="Materi" icon={FileText}>
          <div className="markdown-body"><ReactMarkdown>{module.content || "Konten modul sedang disiapkan."}</ReactMarkdown></div>
        </LessonSection>

        <LessonSection id="video" title="Video lesson" icon={PlayCircle}>
          <div className="overflow-hidden rounded-2xl border border-border bg-foreground text-background">
            <div className="flex aspect-[16/7] items-center justify-center"><div className="text-center"><PlayCircle className="mx-auto h-12 w-12 text-brand-orange" /><div className="mt-3 text-sm font-semibold">Video lesson</div><div className="mt-1 text-xs text-background/60">Gunakan script sebagai panduan observasi di farm.</div></div></div>
          </div>
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
