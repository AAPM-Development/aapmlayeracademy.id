import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import { Bar, Ic } from "@/design-system/canvas";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { AnswerReview, AssessmentBar, AssessmentResult, CheckFeedback, QuestionNavigator, QuizQuestion, checkAnnouncement } from "@/components/academy/AssessmentComponents";
import { useAnswerAssessment, useCertificates, useFinalEligibility, useModules, useQuizQuestions, useStartAssessment, useSubmitAssessment, useUserProgress } from "@/lib/useCourseData";
import { useLearningProfile } from "@/lib/useProfileData";
import { certificationTiers, getCompletedModuleSet, getRankProgress, sortModules } from "@/lib/academyData";
import { buildCurriculum, moduleVisual } from "@/lib/academyVisuals";
import { celebrate, originOf } from "@/lib/celebrate";
import { correctRun } from "@/lib/learningPath";
import { moduleQuizNavigation } from "@/lib/quizNavigation";
import { moduleNo } from "@/lib/moduleNumber";

const CHOICE_LETTERS = "abcdef";

/**
 * "Hadiah belajar" after a passed quiz: module points, the rank bar, a tier
 * that became claimable and the level's progress. Everything here is read
 * back from the server after the attempt was graded.
 */
function QuizRewards({ module, alreadyCompleted, learning, curriculum, completedSet, ownedTiers }) {
  const rank = getRankProgress(learning?.points);
  const level = curriculum.find((item) => item.number === Number(module?.level));
  const claimable = certificationTiers.find((tier) => tier.modules.includes(Number(module?.moduleNumber)) && tier.modules.every((number) => completedSet.has(number)) && !ownedTiers.has(tier.number) && !tier.requiresFinal);
  return (
    <section className="card card-pad stack gap-4 anim-rise" style={{ "--i": 4 }} aria-labelledby="reward-title">
      <div className="card-head">
        <div className="stack gap-0-5">
          <h2 className="card-title" id="reward-title">Hadiah belajar</h2>
          <p className="card-desc">Tercatat otomatis di Prestasi &amp; profil.</p>
        </div>
      </div>
      <div className="stack gap-3">
        <div className="reward wrap" data-hue="gold">
          <span className="xp xp-lg anim-pop" style={{ "--i": 4 }}><Ic name="star" />{alreadyCompleted ? "Tersimpan" : "+100 poin"}</span>
          <div className="stack" style={{ flex: "1 1 180px", minWidth: 0 }}>
            <span className="t-heading">{alreadyCompleted ? "Hasil lulus tetap tersimpan" : "Modul tuntas"}</span>
            <span className="t-caption t-muted">{alreadyCompleted ? "Poin modul ini sudah dihitung sebelumnya" : "Poin modul selesai"} · total {rank.points.toLocaleString("id-ID")} poin</span>
          </div>
        </div>
        <div className="reward" data-hue="gold">
          <span className="tile tile-round" style={{ background: "var(--gold)", color: "var(--on-gold)" }}><Ic name="trend-up" /></span>
          <div className="stack grow gap-1-5">
            <div className="row between wrap gap-2">
              <span className="t-heading">Peringkat: {rank.name}</span>
              <span className="t-caption t-strong t-num">{rank.points.toLocaleString("id-ID")}{rank.to ? `/${rank.to.toLocaleString("id-ID")}` : ""}</span>
            </div>
            <Bar value={rank.percent} onTint animate index={5} label="Progres peringkat" now={rank.points} min={rank.from} max={rank.to || rank.points} />
            <span className="t-caption t-muted">{rank.nextName ? `${rank.toNext.toLocaleString("id-ID")} poin lagi menuju ${rank.nextName}` : "Peringkat tertinggi tercapai"}</span>
          </div>
        </div>
        {claimable ? (
          <div className="reward wrap" data-hue="teal">
            <span className="medal medal-sm anim-pop" style={{ "--i": 6 }}>{claimable.number}</span>
            <div className="stack" style={{ flex: "1 1 220px", minWidth: 0 }}>
              <span className="t-heading">Sertifikat Tingkat {claimable.number} siap diklaim</span>
              <span className="t-caption t-muted">{claimable.name} · Modul {claimable.modules[0]}–{claimable.modules[claimable.modules.length - 1]} tuntas</span>
            </div>
            <Link className="btn btn-gold shine" to="/certification"><Ic name="award" />Klaim sertifikat</Link>
          </div>
        ) : null}
        {level ? (
          <div className="reward" data-hue={level.hue}>
            <span className="tile tile-round tile-solid"><Ic name={level.ic} /></span>
            <div className="stack grow gap-1-5">
              <div className="row between wrap gap-2">
                <span className="t-heading">Level {level.number} · {level.name}</span>
                <span className="t-caption t-strong t-num">{level.completed}/{level.total} modul</span>
              </div>
              <Bar value={level.percent} onTint animate index={6} label={`Progres Level ${level.number}`} now={level.completed} max={level.total} />
              <span className="t-caption t-muted">{level.completed === level.total ? `Level ${level.number} tuntas` : `${level.total - level.completed} modul lagi menuntaskan Level ${level.number}`}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Module quiz, one question per screen (Duolingo-style): choose → Periksa →
 * the action bar turns into the verdict → Lanjut. Each check and the final
 * result come from the server attempt; this page shows what the server decided.
 */
export default function Quiz() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const { data: eligibility } = useFinalEligibility();
  const { data: profile, refetch: refetchProfile } = useLearningProfile();
  const validModule = Number.isInteger(number) && number > 0;
  const { data: introQuestions = [], isLoading: introLoading, isError: introError, refetch: reloadIntro } = useQuizQuestions(validModule ? number : undefined);
  const start = useStartAssessment();
  const answer = useAnswerAssessment();
  const submit = useSubmitAssessment();
  const [attempt, setAttempt] = useState(null);
  const [startState, setStartState] = useState("idle");
  const [current, setCurrent] = useState(0);
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(0);
  const [questionSheetOpen, setQuestionSheetOpen] = useState(false);
  const busyRef = useRef(false);
  const actionRef = useRef(null);
  const visit = useRef(0);
  const startedAt = useRef(Date.now());
  const keyActions = useRef(/** @type {{ choose: (index: number) => boolean, advance: () => void }} */ ({ choose: () => false, advance: () => {} }));

  const questions = attempt?.questions ?? [];
  const passingGrade = attempt?.passingGrade ?? eligibility?.modulePassPercent ?? 70;
  const results = questions.map((item) => (item.checked && item.feedback ? item.feedback.isCorrect : undefined));
  const states = results.map((result) => (result === undefined ? undefined : result ? "done" : "wrong"));
  const navigation = moduleQuizNavigation(questions, current);
  const checkedAnswers = Object.fromEntries(questions.flatMap((item, index) => item.checked ? [[index, item.selectedIndex]] : []));
  const questionNavigator = (
    <QuestionNavigator
      total={questions.length}
      current={current}
      answers={checkedAnswers}
      results={results.map((result) => result === undefined ? null : result ? "correct" : "wrong")}
      answeredLabel="diperiksa"
      passingGrade={passingGrade}
      onSelect={(index) => { setCurrent(index); setQuestionSheetOpen(false); }}
    />
  );
  const question = questions[current];
  const feedback = question?.feedback ?? null;
  const isChecked = Boolean(question?.checked);
  const answerIndex = isChecked ? question.selectedIndex : choices[current];
  const hasAnswer = answerIndex !== undefined && answerIndex !== null;
  const isLast = navigation.isLast;
  const optionCount = Math.min(question?.options?.length || 0, CHOICE_LETTERS.length);
  const run = isChecked && feedback?.isCorrect ? correctRun(results, current) : 0;
  const result = attempt?.result ?? null;
  const submitted = Boolean(result);
  const previousProgress = progress.find((item) => item.moduleNumber === number);
  const sorted = useMemo(() => sortModules(modules), [modules]);
  const module = sorted.find((item) => item.moduleNumber === number);
  const barTitle = module ? module.title : "Kuis modul " + number;
  const barContext = "Kuis · Modul " + number;
  const next = sorted[sorted.findIndex((item) => item.moduleNumber === number) + 1] || null;
  const visual = moduleVisual(module);
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const completedSet = useMemo(() => getCompletedModuleSet(progress, modules), [progress, modules]);
  const ownedTiers = useMemo(() => new Set((Array.isArray(certificates) ? certificates : []).filter((item) => item?.status !== "revoked").map((item) => Number(item.levelNumber ?? item.tierNumber))), [certificates]);
  const [completedBefore, setCompletedBefore] = useState(false);

  const begin = async () => {
    if (busyRef.current || !validModule) return;
    const currentVisit = visit.current;
    busyRef.current = true;
    setBusy(true);
    setStartState("loading");
    try {
      const reply = await start.mutateAsync({ assessmentType: "module_quiz", moduleNumber: number });
      if (visit.current !== currentVisit) return;
      const open = reply.attempt.questions.findIndex((item) => !item.checked);
      setAttempt(reply.attempt);
      setChoices({});
      setCurrent(open === -1 ? Math.max(0, reply.attempt.questions.length - 1) : open);
      startedAt.current = Date.now();
      setStartState("ready");
    } catch (error) {
      if (visit.current !== currentVisit) return;
      if (error?.code === "assessment_unavailable" || error?.code === "assessment_not_found") {
        setStartState("unavailable");
      } else {
        setStartState("error");
        toast({ title: "Kuis belum dapat dimulai", description: error?.message || "Periksa koneksi lalu coba lagi.", variant: "destructive" });
      }
    } finally {
      if (visit.current === currentVisit) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  // Reading the introduction never creates an attempt. Only the start button
  // asks the server to start or resume; leaving the route discards late replies.
  useEffect(() => {
    visit.current += 1;
    busyRef.current = false;
    setBusy(false);
    setStartState("idle");
    setAttempt(null);
    setCurrent(0);
    setChoices({});
    setDuration(0);
    return () => { visit.current += 1; };
  }, [number]);

  const check = async () => {
    if (!question || isChecked || !hasAnswer || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const reply = await answer.mutateAsync({ attemptId: attempt.id, questionId: question.id, answerIndex });
      setAttempt((value) => ({
        ...value,
        questions: value.questions.map((item) => (item.id === question.id
          ? { ...item, checked: true, selectedIndex: reply.selectedIndex, feedback: reply.feedback }
          : item)),
      }));
      // Three right in a row: a small spark from the action bar.
      const nextResults = results.map((value, index) => (index === current ? Boolean(reply.feedback?.isCorrect) : value));
      if (correctRun(nextResults, current) >= 3) celebrate("streak", { origin: originOf(actionRef.current) });
    } catch (error) {
      toast({ title: "Jawaban belum diperiksa", description: error?.message || "Periksa koneksi lalu coba lagi.", variant: "destructive" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!attempt || busyRef.current) return;
    if (!navigation.allChecked) {
      if (navigation.firstUnansweredIndex >= 0) setCurrent(navigation.firstUnansweredIndex);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      setCompletedBefore(Boolean(previousProgress?.completed));
      const reply = await submit.mutateAsync({ attemptId: attempt.id });
      setDuration(Date.now() - startedAt.current);
      refetchProfile();
      setAttempt(reply.attempt);
      // The result screen is the feedback; a toast would repeat it over the bar.
      const outcome = reply.attempt.result;
      if (outcome?.passed) celebrate(outcome.totalQuestions > 0 && outcome.correctAnswers === outcome.totalQuestions ? "milestone" : "burst");
    } catch (error) {
      toast({ title: "Hasil belum tersimpan", description: error?.message || "Periksa koneksi lalu ulangi kuis.", variant: "destructive" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const advance = () => {
    if (busy || submitted || !question) return;
    if (!isChecked) {
      if (hasAnswer) check();
    } else if (isLast && navigation.allChecked) {
      finish();
    } else {
      setCurrent(navigation.nextIndex ?? 0);
    }
  };
  keyActions.current = {
    choose: (index) => {
      if (!question || isChecked || index >= optionCount) return false;
      setChoices((value) => ({ ...value, [current]: index }));
      return true;
    },
    advance,
  };

  // Keyboard flow: letters/digits pick, Enter checks then continues. Native
  // Enter on a focused button or link is left alone so nothing fires twice.
  useEffect(() => {
    if (!attempt || submitted) return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.closest("[role='dialog']"))) return;
      if (event.key === "Enter") {
        if (event.repeat || (target?.closest("button, a") && !target.closest(".choice"))) return;
        event.preventDefault();
        keyActions.current.advance();
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : "";
      const index = /^[1-6]$/.test(key) ? Number(key) - 1 : key ? CHOICE_LETTERS.indexOf(key) : -1;
      if (index >= 0 && keyActions.current.choose(index)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attempt, submitted]);

  const restart = () => {
    setAttempt(null);
    setChoices({});
    setCurrent(0);
    begin();
  };
  const exit = () => navigate(`/modules/${number}`);

  const backToLesson = <Link className="btn btn-secondary" to={`/modules/${number}`}><Ic name="arrow-left" />Kembali ke materi</Link>;
  if (!validModule || startState === "unavailable" || (!introLoading && !introError && !attempt && introQuestions.length === 0)) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="quiz" title="Kuis belum tersedia" description="Soal untuk modul ini sedang disiapkan oleh admin." action={backToLesson} />
      </Page>
    );
  }
  if (introError && !attempt) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="error" icon="quiz" title="Pengantar kuis belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<><Button variant="learn" onClick={() => reloadIntro()}>Coba lagi</Button>{backToLesson}</>} />
      </Page>
    );
  }
  if (startState === "error") {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="error" icon="quiz" title="Kuis belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<><Button variant="learn" onClick={begin}>Coba lagi</Button>{backToLesson}</>} />
      </Page>
    );
  }
  if (!attempt) {
    if (introLoading) return <Page width="narrow"><Skeleton style={{ height: 12 }} /><Skeleton style={{ height: 40, width: "75%" }} />{[0, 1, 2, 3].map((item) => <Skeleton key={item} style={{ height: 64 }} />)}</Page>;
    const total = introQuestions.length;
    const needed = Math.ceil((passingGrade / 100) * total);
    const previousScore = previousProgress?.quizTotal ? Math.round(((previousProgress.quizScore || 0) / previousProgress.quizTotal) * 100) : null;
    return (
      <FocusShell resetKey="intro" hue={visual.hue} label="Pengantar kuis" bar={<AssessmentBar onExit={exit} title={barTitle} context={barContext} total={total} current={-1} />}>
        <div className="quiz-center">
          <div className="stack items-center gap-5 w-full quiz-intro">
            <div className="appi-stage">
              <AppiMascot mood="happy" size="hero" enter="pop" />
              <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: -18, top: 4, width: 30 }} />
              <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ left: -14, top: 40, width: 18, "--i": 2 }} />
            </div>
            <header className="stack items-center gap-2 t-center">
              <span className="t-overline t-ink">Kuis · Modul {number}</span>
              <h1 className="t-title">Siap menguji pemahaman?</h1>
              <p className="t-body t-muted t-pretty">Jawab {total} soal tentang {barTitle}.</p>
            </header>
            <section className="card card-pad w-full anim-rise" style={{ "--i": 1 }} aria-labelledby="rules-title">
              <h2 className="sr-only" id="rules-title">Aturan kuis</h2>
              <ul className="stack gap-3">
                <li className="row gap-3"><span className="tile tile-sm"><Ic name="exam" /></span><span className="t-body"><span className="t-strong">{total} soal</span> pilihan ganda</span></li>
                <li className="row gap-3"><span className="tile tile-sm"><Ic name="target" /></span><span className="t-body"><span className="t-strong">Nilai lulus {passingGrade}%</span> · minimal {needed} dari {total} tepat</span></li>
                <li className="row gap-3"><span className="tile tile-sm"><Ic name="check-circle" /></span><span className="t-body">Umpan balik langsung setelah <span className="t-strong">Periksa</span>; jawaban yang diperiksa terkunci</span></li>
                <li className="row gap-3"><span className="tile tile-sm"><Ic name="refresh" /></span><span className="t-body">Bisa diulang kapan saja; hasil lulus tetap tersimpan</span></li>
              </ul>
            </section>
            <span className="xp anim-pop" style={{ "--i": 2 }}><Ic name="star" />{previousProgress?.completed ? "Modul ini sudah tuntas" : "+100 poin & modul tuntas saat lulus"}</span>
            {previousScore !== null ? <span className="t-caption t-muted">Skor sebelumnya {previousScore}%</span> : null}
            <div className="stack gap-3 w-full">
              <button type="button" className="btn btn-learn btn-lg btn-block" disabled={busy} aria-busy={busy || undefined} onClick={begin}>
                {startState === "loading" ? "Menyiapkan kuis…" : previousProgress?.activeAttempt ? "Lanjutkan kuis" : "Mulai kuis"}<Ic name="arrow-right" />
              </button>
              <Link className="btn btn-secondary btn-lg btn-block" to={`/modules/${number}`}><Ic name="book" />Baca ulang materi</Link>
            </div>
            <p className="row wrap justify-center gap-1-5 t-caption t-muted hide-sm">Pilih dengan <span className="kbd">A</span>–<span className="kbd">D</span> · <span className="kbd">Enter</span> untuk memeriksa</p>
          </div>
        </div>
      </FocusShell>
    );
  }

  if (submitted) {
    const streak = results.reduce((best, value, index) => Math.max(best, value ? correctRun(results, index) : 0), 0);
    return (
      <FocusShell resetKey="result" label="Hasil kuis" bar={<AssessmentBar onExit={exit} title={barTitle} context={`Hasil kuis · Modul ${number}`} total={questions.length} current={questions.length - 1} states={states} hue="green" />}>
        <div className="quiz-result">
          <AssessmentResult passed={result.passed} score={result.correctAnswers} total={result.totalQuestions} passingGrade={result.passingGrade} duration={duration} streak={streak} description={result.passed ? `Modul ${number} tuntas.${next ? ` Anda siap untuk ${next.title}.` : " Semua modul selesai."}` : undefined}>
            {result.passed ? <QuizRewards module={module} alreadyCompleted={completedBefore} learning={profile?.learning} curriculum={curriculum} completedSet={completedSet} ownedTiers={ownedTiers} /> : null}
            <div className="row wrap justify-center gap-3">
              {result.passed ? (
                <Link className="btn btn-learn btn-lg btn-block-sm" to={next ? `/modules/${next.moduleNumber}` : "/modules"}>{next ? `Lanjut ke Modul ${moduleNo(next)}` : "Kembali ke jalur belajar"}<Ic name="arrow-right" /></Link>
              ) : (
                <button type="button" className="btn btn-learn btn-lg btn-block-sm" onClick={restart}><Ic name="refresh" />Ulangi kuis</button>
              )}
              {result.passed ? (
                <button type="button" className="btn btn-secondary btn-lg btn-block-sm" onClick={restart}><Ic name="refresh" />Ulangi kuis</button>
              ) : (
                <Link className="btn btn-secondary btn-lg btn-block-sm" to={`/modules/${number}`}><Ic name="book" />Pelajari ulang materi</Link>
              )}
            </div>
            <AnswerReview questions={questions} />
          </AssessmentResult>
        </div>
      </FocusShell>
    );
  }

  // The action bar keeps its button last so the same button node moves from
  // Periksa to Lanjut and keyboard focus stays on it.
  return (
    <FocusShell
      resetKey={current}
      hue={visual.hue}
      label={`Kuis modul ${number}`}
      outlineLabel="Navigasi soal"
      outline={questionNavigator}
      bar={(
        <AssessmentBar onExit={exit} title={barTitle} context={barContext} total={questions.length} current={current} states={states}>
          <button type="button" className="btn btn-ghost btn-icon btn-quiet show-md" aria-label={`Daftar soal, ${navigation.checkedCount} dari ${navigation.total} diperiksa`} onClick={() => setQuestionSheetOpen(true)}><Ic name="list" /></button>
        </AssessmentBar>
      )}
      footerTone={isChecked ? (feedback?.isCorrect ? "success" : "danger") : undefined}
      footer={(
        <>
          <p className="aapm-visually-hidden" role="status">{isChecked ? checkAnnouncement(question, feedback, run) : ""}</p>
          {isChecked ? (
            <CheckFeedback question={question} feedback={feedback} run={run} />
          ) : (
            <>
              <button type="button" className="btn btn-ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} aria-label="Soal sebelumnya">
                <Ic name="arrow-left" /><span className="hide-sm">Sebelumnya</span>
              </button>
              <p className="grow row wrap justify-center gap-1-5 t-caption t-muted hide-sm">
                Pilih dengan <span className="kbd">A</span>–<span className="kbd">{CHOICE_LETTERS[optionCount - 1]?.toUpperCase()}</span> atau <span className="kbd">1</span>–<span className="kbd">{optionCount}</span> · <span className="kbd">Enter</span> untuk memeriksa
              </p>
            </>
          )}
          <div className="ml-auto quiz-action" ref={actionRef}>
            {!isChecked ? (
              <button type="button" className="btn btn-learn btn-lg btn-block-sm" disabled={!hasAnswer || busy} onClick={check}>Periksa</button>
            ) : isLast && navigation.allChecked ? (
              <button type="button" className="btn btn-learn btn-lg btn-block-sm" disabled={busy} aria-busy={busy || undefined} onClick={finish}>Lihat hasil<Ic name="arrow-right" /></button>
            ) : isLast ? (
              <button type="button" className="btn btn-learn btn-lg btn-block-sm" onClick={() => setCurrent(navigation.nextIndex ?? 0)}>Ke soal {Number(navigation.nextIndex) + 1}<Ic name="arrow-right" /></button>
            ) : (
              <button type="button" className="btn btn-learn btn-lg btn-block-sm" onClick={() => setCurrent((value) => value + 1)}>Lanjut<Ic name="arrow-right" /></button>
            )}
          </div>
        </>
      )}
    >
      <div className="quiz-center quiz-center-top">
        <QuizQuestion
          question={question}
          number={current + 1}
          total={questions.length}
          answer={answerIndex}
          revealed={isChecked}
          correctIndex={feedback?.correctIndex}
          onAnswer={(index) => { if (!isChecked) setChoices((value) => ({ ...value, [current]: index })); }}
        />
      </div>
      <Sheet open={questionSheetOpen} onOpenChange={setQuestionSheetOpen}>
        <SheetContent side="bottom">
          <SheetTitle className="sr-only">Pilih soal kuis</SheetTitle>
          <SheetDescription className="sr-only">Pilih soal untuk menjawab atau meninjau jawaban yang sudah diperiksa.</SheetDescription>
          <div className="sheet-body" style={{ gap: "var(--s-3)", paddingTop: "var(--s-6)" }}>{questionNavigator}</div>
        </SheetContent>
      </Sheet>
    </FocusShell>
  );
}
