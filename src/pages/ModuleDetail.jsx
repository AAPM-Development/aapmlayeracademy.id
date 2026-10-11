import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Sheet, SheetContent, SheetTitle, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import { Ic } from "@/design-system/canvas";
import { Tooltip } from "@/design-system/components/tooltip";
import FlowSteps, { moduleFlowSteps } from "@/components/learn/FlowSteps";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { LessonHeader, LessonMedia, LessonSection, LessonToc, lessonSections } from "@/components/academy/LessonWorkspace";
import { CourseOutline } from "@/components/academy/CourseElements";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { useAcknowledgeModule, useFinalEligibility, useModules, usePracticeAttestation, useQuizQuestions, useStudyTimeIncrement, useUserProgress } from "@/lib/useCourseData";
import { getProgressSummary, sortModules } from "@/lib/academyData";
import { buildCurriculum, estimateMinutes, moduleFlowState, moduleVisual } from "@/lib/academyVisuals";
import { celebrate } from "@/lib/celebrate";
import { askAppi } from "@/lib/askAppi";
import AppiMascot from "@/components/appi/AppiMascot";
import useStudyTime from "@/lib/useStudyTime";
import { editorialLearnerNavigationItems, hasEditorialVideo } from "@/lib/editorialDocument";
import { scrollLessonSection } from "@/lib/lessonNavigation";
import { moduleNo } from "@/lib/moduleNumber";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasListContent = (value) => Array.isArray(value)
  ? value.some((item) => hasText(String(item || "")))
  : hasText(value);
const OUTLINE_KEY = "aapm-lesson-outline";

function readOutlinePreference() {
  try {
    return window.localStorage.getItem(OUTLINE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function StandaloneState({ children }) {
  return <Page width="narrow" className="min-h-[60vh] justify-center">{children}</Page>;
}

/**
 * Lesson player in the focus shell (canvas "Lesson"): a focus bar with the
 * module flow and reading line, the course outline, the 760 px reading column
 * with its TOC rail, and one primary action in the bar below.
 */
export default function ModuleDetail() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const { data: questions = [] } = useQuizQuestions(Number.isFinite(number) ? number : null);
  const { data: eligibility } = useFinalEligibility();
  const practice = usePracticeAttestation();
  const acknowledge = useAcknowledgeModule();
  const studyTime = useStudyTimeIncrement();
  const [activeSection, setActiveSection] = useState("content");
  const [outlineOpen, setOutlineOpen] = useState(readOutlinePreference);
  const [outlineSheet, setOutlineSheet] = useState(false);
  // The practice check answers at once; the saved value takes over after refetch.
  const [practiceOverride, setPracticeOverride] = useState(null);
  const mainRef = useRef(null);
  const barRef = useRef(null);
  const readingRef = useRef(null);
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
  const minutes = module ? estimateMinutes(module) : null;
  const passPercent = eligibility?.modulePassPercent ?? 70;

  const editorialVideoIsPresent = useMemo(() => hasEditorialVideo(module?.editorialContent), [module?.editorialContent]);
  const editorialNavigationItems = useMemo(() => editorialLearnerNavigationItems(module?.editorialContent), [module?.editorialContent]);
  const legacyVideoIsPresent = [module?.videoUrl, module?.videoEmbedUrl, module?.video, module?.videoScript].some(hasText);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  const flowProgress = practiceOverride === null ? moduleProgress : { ...moduleProgress, practicalDone: practiceOverride };
  const flow = moduleFlowState({ module, progress: flowProgress, hasPractice: practiceIsPresent, quizCount: questions.length });
  const steps = moduleFlowSteps({ progress: flowProgress, hasPractice: practiceIsPresent, hasQuiz: flow.hasQuiz });

  const learnerSections = useMemo(() => {
    const visible = lessonSections.filter((section) => {
      if (section.id === "video") return !editorialVideoIsPresent && legacyVideoIsPresent;
      if (section.id === "objectives") return objectivesArePresent;
      if (section.id === "practical") return practiceIsPresent;
      return true;
    });
    const [contentSection, ...remaining] = visible;
    return [contentSection, ...editorialNavigationItems, ...remaining, { id: "lanjut", label: "Langkah berikutnya" }].filter(Boolean);
  }, [editorialNavigationItems, editorialVideoIsPresent, legacyVideoIsPresent, objectivesArePresent, practiceIsPresent]);

  // Reading progress: the line under the focus bar and the TOC card fill as
  // the learner scrolls (CSS variable only, no re-render per scroll event).
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = main.scrollHeight - main.clientHeight;
      const percent = Math.round((max > 0 ? Math.min(1, main.scrollTop / max) : 1) * 100);
      barRef.current?.style.setProperty("--p", String(percent));
      const card = readingRef.current;
      if (card) {
        card.style.setProperty("--p", String(percent));
        const value = card.querySelector("[data-reading-value]");
        if (value) value.textContent = `${percent}%`;
        const left = card.querySelector("[data-reading-left]");
        const total = Number(card.dataset.minutes) || 0;
        if (left && total) {
          const remaining = Math.max(0, Math.ceil(total * (1 - percent / 100)));
          left.textContent = remaining ? `Sekitar ${remaining} menit lagi` : "Selesai dibaca";
        }
      }
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => { main.removeEventListener("scroll", onScroll); window.cancelAnimationFrame(frame); };
  });

  useEffect(() => {
    setActiveSection("content");
    setPracticeOverride(null);
    setOutlineSheet(false);
  }, [number]);

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

  const toggleOutline = () => setOutlineOpen((current) => {
    try {
      window.localStorage.setItem(OUTLINE_KEY, current ? "hidden" : "shown");
    } catch {
      // Optional preference.
    }
    return !current;
  });

  // Active reading time goes to "Waktu belajar" when the learner leaves the lesson.
  // The server accepts at most 15 minutes per increment, so a longer session is sent in parts.
  const recordStudyTime = async (moduleNumber, minutes) => {
    for (let remaining = minutes; remaining > 0; remaining -= 15) {
      try {
        await studyTime.mutateAsync({ moduleNumber, minutes: Math.min(15, remaining) });
      } catch {
        return;
      }
    }
  };
  useStudyTime(module?.moduleNumber, recordStudyTime);

  const togglePracticeDone = async (done) => {
    setPracticeOverride(done);
    try {
      await practice.mutateAsync({ moduleNumber: number, attested: done });
    } catch {
      setPracticeOverride(null);
      toast({ title: "Status praktik belum tersimpan", description: "Coba lagi setelah koneksi kembali normal.", variant: "destructive" });
    }
  };

  const markComplete = async () => {
    if (!module || moduleProgress?.completed) return;
    try {
      await acknowledge.mutateAsync(number);
      celebrate();
      toast({ title: "Modul diselesaikan", description: next ? `Berikutnya: ${next.title}` : "Semua modul sudah Anda tuntaskan." });
    } catch {
      toast({ title: "Progres belum tersimpan", description: "Coba lagi setelah koneksi kembali normal.", variant: "destructive" });
    }
  };

  const jumpToSection = (section) => {
    setActiveSection(section);
    scrollLessonSection(mainRef.current, document.getElementById(section), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  };

  if (modulesError || progressError) {
    return <StandaloneState><LearningErrorState title="Lesson belum dapat dimuat" description="Materi atau progres Anda belum berhasil diambil. Coba lagi untuk membuka lesson ini." onRetry={() => { refetchModules(); refetchProgress(); }} /></StandaloneState>;
  }
  if (isLoading) return <StandaloneState><LearningLoading label="Memuat lesson…" lines={2} /></StandaloneState>;
  if (!module) {
    return <StandaloneState><LearningEmptyState title="Modul belum tersedia" description="Materi ini belum tersedia atau tautannya sudah berubah. Kembali ke jalur belajar untuk memilih materi lain." actionLabel="Kembali ke jalur belajar" actionTo="/modules" /></StandaloneState>;
  }

  const outline = (
    <CourseOutline
      curriculum={curriculum}
      currentNumber={number}
      completed={summary.completed}
      total={summary.total}
      onNavigate={() => setOutlineSheet(false)}
    />
  );
  const askAboutModule = () => askAppi(`Saya sedang belajar Modul ${moduleNo(module)}: ${module.title}. Bantu saya memahami poin pentingnya dan cara menerapkannya di kandang.`);

  // Primary next step follows the bounded flow: Materi → Praktik → Kuis → Selesai.
  // A quiz module is complete only when the quiz is passed, so no shortcut button here.
  let completionAction;
  if (flow.completed) {
    completionAction = next
      ? <Link className="btn btn-learn btn-lg lesson-primary" to={`/modules/${next.moduleNumber}`} aria-label="Modul berikutnya"><span>Modul berikutnya</span><Ic name="arrow-right" /></Link>
      : <Link className="btn btn-learn btn-lg lesson-primary" to="/final-exam">Ujian akhir<Ic name="arrow-right" /></Link>;
  } else if (flow.hasQuiz) {
    const quizLabel = flow.activeAttempt ? "Lanjutkan kuis" : flow.quizAttempted && !flow.quizPassed ? "Ulangi kuis" : "Mulai kuis";
    completionAction = <Link className="btn btn-learn btn-lg lesson-primary" to={`/quiz/${number}`}>{quizLabel}<Ic name="arrow-right" /></Link>;
  } else {
    completionAction = (
      <button type="button" className="btn btn-learn btn-lg lesson-primary" disabled={acknowledge.isPending} aria-busy={acknowledge.isPending || undefined} onClick={markComplete}>
        <Ic name="check" />Tandai selesai
      </button>
    );
  }

  return (
    <FocusShell
      ref={mainRef}
      resetKey={number}
      hue={visual.hue}
      label={`Lesson modul ${number}`}
      outline={outline}
      outlineLabel="Kurikulum course"
      outlineOpen={outlineOpen}
      bar={(
        <header className="focus-bar" ref={barRef} style={{ "--p": 0 }}>
          <Tooltip content="Keluar ke jalur belajar">
            <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label="Keluar ke jalur belajar" onClick={() => navigate("/modules")}><Ic name="x" /></button>
          </Tooltip>
          <button type="button" className="btn btn-ghost btn-icon btn-quiet hide-md" aria-label={outlineOpen ? "Sembunyikan kurikulum" : "Tampilkan kurikulum"} aria-pressed={outlineOpen} onClick={toggleOutline}><Ic name="sidebar" /></button>
          <span className="vr hide-sm" style={{ margin: "14px 4px" }} />
          <div className="stack grow" style={{ minWidth: 0 }}>
            <span className="t-caption t-muted t-clamp-1">Modul {moduleNo(module)} dari {summary.total} · Level {module.level} {module.levelName || module.category}</span>
            <span className="t-heading t-clamp-1">{module.title}</span>
          </div>
          <FlowSteps steps={steps} className="hide-md" style={{ width: 380 }} />
          <span className="vr hide-md" style={{ margin: "14px 4px" }} />
          <button type="button" className="btn btn-ghost btn-icon btn-quiet show-md" aria-label="Buka kurikulum" aria-expanded={outlineSheet} onClick={() => setOutlineSheet(true)}><Ic name="list" /></button>
          <button type="button" className="btn btn-ai-soft btn-sm lesson-appi" aria-label="Tanya APPI tentang modul ini" onClick={askAboutModule}><Ic name="sparkle" /><span className="hide-sm">Tanya APPI</span></button>
          <span className="reading" aria-hidden="true" />
        </header>
      )}
      footer={(
        <>
          {previous ? (
            <Link className="btn btn-secondary lesson-prev" to={`/modules/${previous.moduleNumber}`} aria-label={`Modul sebelumnya: ${previous.title}`}>
              <Ic name="arrow-left" /><span className="hide-sm">Modul {moduleNo(previous)}</span>
            </Link>
          ) : <span className="hide-sm" />}
          <span className="grow t-center t-caption t-muted hide-sm">
            {flow.hasQuiz ? "Praktik dapat dicatat kapan saja · kuis menentukan penyelesaian modul" : "Praktik dapat dicatat kapan saja · konfirmasi setelah materi dipahami"}
          </span>
          {flow.completed || flow.hasQuiz ? completionAction : (
            next ? <Link className="btn btn-learn btn-lg lesson-primary" to={`/modules/${next.moduleNumber}`}>Modul berikutnya<Ic name="arrow-right" /></Link>
              : <Link className="btn btn-secondary btn-lg lesson-primary" to="/modules">Jalur belajar<Ic name="arrow-right" /></Link>
          )}
        </>
      )}
    >
      <div className="lesson-stage">
        <article className="reading-col" aria-labelledby="lesson-title" data-hue={visual.hue}>
          <LessonHeader module={module} completed={flow.completed} hue={visual.hue} minutes={minutes} banner={visual.image} bannerFocus={visual.focus} />

          <LessonSection id="content" title="Materi" ic="book">
            <EditorialContent document={module.editorialContent} fallback={module.content} title={module.title} />
          </LessonSection>

          {!editorialVideoIsPresent && legacyVideoIsPresent && (
            <LessonSection id="video" title="Video materi" ic="video" hue="violet">
              <LessonMedia module={module} />
              {hasText(module.videoScript) && (
                <details className="card card-pad-sm lesson-notes">
                  <summary className="row gap-2 t-support t-medium"><Ic name="chev-right" size="sm" />Catatan instruktur</summary>
                  <p className="t-body t-muted">{module.videoScript}</p>
                </details>
              )}
            </LessonSection>
          )}

          {(objectivesArePresent || practiceIsPresent) && (
            <LessonStructuredContent
              module={module}
              document={module.editorialContent}
              practiceAction={(
                <label className="card card-pad-sm check" style={{ padding: "14px 16px", alignItems: "flex-start" }}>
                  <input type="checkbox" checked={flow.practicalDone} disabled={practice.isPending} onChange={(event) => togglePracticeDone(event.target.checked)} />
                  <span className="stack gap-0-5">
                    <span className="t-strong">Saya sudah mengerjakan praktik ini</span>
                    <span className="t-caption t-muted">{flow.practicalDone ? "Praktik tercatat. Hasil kuis menentukan penyelesaian modul berkuis." : "Catat setelah dikerjakan. Praktik bisa menyusul dan bukan syarat membuka kuis. +35 poin"}</span>
                  </span>
                </label>
              )}
            />
          )}

          {practice.isError || acknowledge.isError ? <Alert tone="danger" title="Progres belum tersimpan" description="Silakan coba lagi." /> : null}
          {moduleProgress?.verificationStatus === "legacy_unverified" ? (
            <Alert
              tone="warning"
              title="Penyelesaian lama perlu diverifikasi"
              description={flow.hasQuiz ? "Modul ini ditandai selesai sebelum sistem kuis baru. Ulangi kuis untuk mencatatnya secara resmi." : "Modul ini ditandai selesai sebelum sistem baru. Tandai selesai lagi untuk mencatatnya secara resmi."}
            />
          ) : null}

          <section className="callout peek-host lesson-next" id="lanjut" aria-labelledby="h-lanjut" data-hue={flow.completed ? "green" : "ai"}>
            <AppiMascot mood={flow.completed ? "proud" : flow.hasQuiz ? "wink" : "talk"} size="lg" enter="peek" label={flow.completed ? "APPI bangga" : "APPI menyemangati"} />
            <div className="stack gap-1" style={{ flex: "1 1 200px", minWidth: 0 }}>
              <h2 className="t-heading" id="h-lanjut">{flow.completed ? "Modul ini sudah tuntas" : flow.hasQuiz ? "Siap uji pemahaman?" : "Selesai membaca?"}</h2>
              <p className="t-support t-muted">
                {flow.completed
                  ? next ? `Lanjutkan ke Modul ${moduleNo(next)}: ${next.title}.` : "Semua modul tuntas — saatnya ujian akhir."
                  : flow.hasQuiz ? `${questions.length ? `${questions.length} soal · ` : ""}nilai lulus ${passPercent}% · umpan balik langsung.` : "Konfirmasikan setelah materi dipahami."}
              </p>
            </div>
            {flow.completed ? (
              flow.hasQuiz ? <Link className="btn btn-secondary btn-sm" to={`/quiz/${number}`}><Ic name="refresh" />Ulangi kuis</Link> : null
            ) : (
              <span className="xp"><Ic name="star" />+100 poin</span>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={askAboutModule}><Ic name="sparkle" />Tanya APPI dulu</button>
          </section>
        </article>

        <aside className="toc" aria-label="Di halaman ini">
          <LessonToc sections={learnerSections} activeSection={activeSection} onSectionChange={jumpToSection} readingRef={readingRef} minutes={minutes} />
        </aside>
      </div>

      <Sheet open={outlineSheet} onOpenChange={setOutlineSheet}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <div className="sheet-head">
            <div className="stack gap-0-5"><SheetTitle>Kurikulum</SheetTitle><span className="t-caption t-muted">{summary.completed}/{summary.total} modul selesai · {summary.percent}%</span></div>
          </div>
          <div className="sheet-body" style={{ gap: "var(--s-2)" }}>{outline}</div>
        </SheetContent>
      </Sheet>
    </FocusShell>
  );
}
