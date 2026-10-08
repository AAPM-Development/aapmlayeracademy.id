import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, IconButton, Progress, Sheet, SheetContent, SheetTitle, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { LessonHeader, LessonMedia, LessonSection, LessonToc, lessonSections } from "@/components/academy/LessonWorkspace";
import { CourseOutline, ModuleFlow } from "@/components/academy/CourseElements";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useModules, useQuizQuestions, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { getProgressSummary, sortModules } from "@/lib/academyData";
import { buildCurriculum, estimateMinutes, moduleFlowState, moduleVisual } from "@/lib/academyVisuals";
import { celebrate } from "@/lib/celebrate";
import { editorialLearnerNavigationItems, hasEditorialVideo } from "@/lib/editorialDocument";

const OUTLINE_KEY = "aapm-lesson-outline";
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasListContent = (value) => Array.isArray(value)
  ? value.some((item) => hasText(String(item || "")))
  : hasText(value);

function readOutlinePreference() {
  try {
    return window.localStorage.getItem(OUTLINE_KEY) !== "closed";
  } catch {
    return true;
  }
}

function StandaloneState({ children }) {
  return <Page width="narrow" className="min-h-[60vh] justify-center">{children}</Page>;
}

export default function ModuleDetail() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const { data: questions = [] } = useQuizQuestions(Number.isFinite(number) ? number : null);
  const saveProgress = useSaveProgress();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const [activeSection, setActiveSection] = useState("content");
  const [outlineOpen, setOutlineOpen] = useState(readOutlinePreference);
  const [outlineSheet, setOutlineSheet] = useState(false);
  const mainRef = useRef(null);
  const isLoading = modulesLoading || progressLoading;

  const sortedModules = useMemo(() => sortModules(modules), [modules]);
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const summary = getProgressSummary(modules, progress);
  const module = sortedModules.find((item) => item.moduleNumber === number);
  const moduleProgress = progress.find((item) => item.moduleNumber === number);
  const index = sortedModules.findIndex((item) => item.moduleNumber === number);
  const previous = index > 0 ? sortedModules[index - 1] : null;
  const next = index >= 0 ? sortedModules[index + 1] || null : null;
  const visual = moduleVisual(module);

  const editorialVideoIsPresent = useMemo(() => hasEditorialVideo(module?.editorialContent), [module?.editorialContent]);
  const editorialNavigationItems = useMemo(() => editorialLearnerNavigationItems(module?.editorialContent), [module?.editorialContent]);
  const legacyVideoIsPresent = [module?.videoUrl, module?.videoEmbedUrl, module?.video, module?.videoScript].some(hasText);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  const flow = moduleFlowState({ module, progress: moduleProgress, hasPractice: practiceIsPresent, quizCount: questions.length });

  const learnerSections = useMemo(() => {
    const visible = lessonSections.filter((section) => {
      if (section.id === "video") return !editorialVideoIsPresent && legacyVideoIsPresent;
      if (section.id === "objectives") return objectivesArePresent;
      if (section.id === "practical") return practiceIsPresent;
      return true;
    });
    const [contentSection, ...remaining] = visible;
    return [contentSection, ...editorialNavigationItems, ...remaining].filter(Boolean);
  }, [editorialNavigationItems, editorialVideoIsPresent, legacyVideoIsPresent, objectivesArePresent, practiceIsPresent]);

  useEffect(() => setActiveSection("content"), [number]);

  useEffect(() => {
    if (!module) return undefined;
    const elements = learnerSections.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!elements.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { root: mainRef.current, rootMargin: "-12% 0px -62%", threshold: [0, 0.2] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [module?.moduleNumber, learnerSections]);

  const toggleOutline = () => {
    setOutlineOpen((current) => {
      try {
        window.localStorage.setItem(OUTLINE_KEY, current ? "closed" : "open");
      } catch {
        // Optional preference.
      }
      return !current;
    });
  };

  const markComplete = async () => {
    if (!module || moduleProgress?.completed) return;
    try {
      await save({ moduleNumber: number, data: { moduleNumber: number, completed: true } });
      celebrate();
      toast({ title: "Modul diselesaikan", description: next ? `Berikutnya: ${next.title}` : "Semua modul sudah Anda tuntaskan." });
    } catch {
      toast({ title: "Progress belum tersimpan", description: "Coba lagi setelah koneksi kembali normal.", variant: "destructive" });
    }
  };

  const jumpToSection = (section) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (modulesError || progressError) {
    return <StandaloneState><LearningErrorState title="Lesson belum dapat dimuat" description="Materi atau progress Anda belum berhasil diambil. Coba lagi untuk membuka lesson ini." onRetry={() => { refetchModules(); refetchProgress(); }} /></StandaloneState>;
  }
  if (isLoading) return <StandaloneState><LearningLoading label="Memuat lesson…" lines={2} /></StandaloneState>;
  if (!module) {
    return <StandaloneState><LearningEmptyState title="Modul belum tersedia" description="Materi ini belum tersedia atau tautannya sudah berubah. Kembali ke jalur belajar untuk memilih materi lain." actionLabel="Kembali ke jalur belajar" actionTo="/modules" /></StandaloneState>;
  }

  const sectionIndex = Math.max(0, learnerSections.findIndex((section) => section.id === activeSection));
  const activeStep = activeSection === "practical" ? "practice" : "content";
  const outline = (
    <CourseOutline
      curriculum={curriculum}
      currentNumber={number}
      completed={summary.completed}
      total={summary.total}
      onNavigate={() => setOutlineSheet(false)}
    />
  );

  // Primary next step follows the bounded flow: Materi → Praktik → Kuis → Selesai.
  // A quiz module is complete only when the quiz is passed, so no shortcut button here.
  const onPracticeSection = activeSection === "practical";
  const continueToPractice = !flow.completed && flow.hasPractice && !flow.quizAttempted && !onPracticeSection;
  let primaryAction;
  if (flow.completed) {
    primaryAction = next
      ? <Button asChild variant="learn"><Link to={`/modules/${next.moduleNumber}`}>Modul berikutnya<AapmIcon name="arrowRight" /></Link></Button>
      : <Button asChild variant="learn"><Link to="/final-exam">Ujian akhir<AapmIcon name="arrowRight" /></Link></Button>;
  } else if (continueToPractice) {
    primaryAction = <Button variant="learn" onClick={() => jumpToSection("practical")}>Lanjut ke praktik<AapmIcon name="arrowRight" /></Button>;
  } else if (flow.hasQuiz) {
    const quizLabel = flow.quizAttempted && !flow.quizPassed ? "Ulangi kuis" : "Kerjakan kuis";
    primaryAction = <Button asChild variant="learn"><Link to={`/quiz/${number}`}>{quizLabel}<AapmIcon name="arrowRight" /></Link></Button>;
  } else {
    primaryAction = <Button variant="learn" loading={saveProgress.isPending} leadingIcon="check" onClick={markComplete}>Tandai selesai</Button>;
  }

  return (
    <FocusShell
      ref={mainRef}
      resetKey={number}
      label={`Lesson modul ${number}`}
      outline={outline}
      outlineOpen={outlineOpen}
      bar={(
        <header className="aapm-topbar aapm-focus__bar" data-hue={visual.hue}>
          <IconButton label="Keluar ke jalur belajar" icon="close" onClick={() => navigate("/modules")} />
          <div className="aapm-topbar__title">
            <span className="aapm-topbar__context">Modul {module.moduleNumber} dari {summary.total} · {module.levelName || module.category}</span>
            <p className="aapm-topbar__title-text">{module.title}</p>
          </div>
          <div className="aapm-topbar__actions">
            <IconButton className="hidden lg:inline-flex" label={outlineOpen ? "Sembunyikan kurikulum" : "Tampilkan kurikulum"} icon="sidebar" onClick={toggleOutline} />
            <IconButton className="lg:hidden" label="Buka kurikulum" icon="list" onClick={() => setOutlineSheet(true)} />
            <div className="aapm-focus__progress">
              <Progress value={summary.percent} label="Progress course" />
              <span>{summary.percent}%</span>
            </div>
          </div>
        </header>
      )}
      footer={(
        <>
          <div className="aapm-focus__footer-group">
            {previous ? (
              <Button asChild variant="secondary" data-hide-label-mobile="">
                <Link to={`/modules/${previous.moduleNumber}`} aria-label={`Modul sebelumnya: ${previous.title}`}><AapmIcon name="arrowLeft" /><span>Sebelumnya</span></Link>
              </Button>
            ) : null}
          </div>
          <p className="aapm-focus__footer-center">
            Bagian {sectionIndex + 1} dari {learnerSections.length} · {learnerSections[sectionIndex]?.label}
          </p>
          <div className="aapm-focus__footer-group">
            {primaryAction}
          </div>
        </>
      )}
    >
      <div className="aapm-lesson-layout">
        <article className="aapm-lesson" data-hue={visual.hue}>
          <div className="mb-6">
            <ModuleFlow flow={flow} active={activeStep} onSelect={(step) => jumpToSection(step === "practice" ? "practical" : "content")} quizTo={`/quiz/${number}`} />
          </div>
          <LessonHeader module={module} completed={flow.completed} hue={visual.hue} minutes={estimateMinutes(module)} />

          <LessonSection id="content" title="Materi" icon="lesson" hue={visual.hue}>
            <EditorialContent document={module.editorialContent} fallback={module.content} title={module.title} />
          </LessonSection>

          {!editorialVideoIsPresent && legacyVideoIsPresent && (
            <LessonSection id="video" title="Video materi" icon="video" hue="violet">
              <LessonMedia module={module} />
              {hasText(module.videoScript) && (
                <details className="aapm-callout mt-4" data-hue="violet">
                  <summary className="aapm-callout__title cursor-pointer">Catatan instruktur</summary>
                  <p className="m-0 text-body text-muted-foreground">{module.videoScript}</p>
                </details>
              )}
            </LessonSection>
          )}

          {(objectivesArePresent || practiceIsPresent) && <LessonStructuredContent module={module} document={module.editorialContent} />}

          <section className="aapm-lesson-section" aria-label="Langkah berikutnya">
            {saveProgress.isError ? <Alert tone="danger" title="Progress belum tersimpan" description="Silakan coba tombol selesai lagi." className="mb-4" /> : null}
            <div className="aapm-callout" data-hue={flow.completed ? "green" : "orange"}>
              <div className="aapm-callout__head">
                <span className="aapm-icon-tile" data-hue={flow.completed ? "green" : "orange"} data-variant="badge" data-shape="circle"><AapmIcon name={flow.completed ? "check" : flow.hasQuiz ? "quiz" : "flag"} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="aapm-callout__title">
                    {flow.completed ? "Modul ini sudah selesai" : flow.hasQuiz ? "Siap uji pemahaman?" : "Selesai membaca?"}
                  </h3>
                  <p className="m-0 text-support text-muted-foreground">
                    {flow.completed
                      ? next ? `Lanjutkan ke modul ${next.moduleNumber}: ${next.title}.` : "Semua modul tuntas — saatnya ujian akhir."
                      : flow.hasQuiz ? `${questions.length} soal singkat · nilai lulus 70%.` : "Tandai selesai untuk menyimpan progress Anda."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">{primaryAction}</div>
            </div>
          </section>
        </article>
        <aside className="aapm-lesson-layout__toc">
          <LessonToc sections={learnerSections} activeSection={activeSection} onSectionChange={jumpToSection} />
        </aside>
      </div>

      <Sheet open={outlineSheet} onOpenChange={setOutlineSheet}>
        <SheetContent side="left" className="aapm-nav-sheet" aria-describedby={undefined}>
          <SheetTitle className="aapm-visually-hidden">Kurikulum course</SheetTitle>
          {outline}
        </SheetContent>
      </Sheet>
    </FocusShell>
  );
}
