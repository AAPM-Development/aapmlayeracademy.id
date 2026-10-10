import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import AppiMascot from "@/components/appi/AppiMascot";
import { AnswerReview, AssessmentBar, AssessmentResult, CheckFeedback, QuizQuestion, checkAnnouncement } from "@/components/academy/AssessmentComponents";
import { useAnswerAssessment, useModules, useQuizQuestions, useStartAssessment, useSubmitAssessment, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";
import { celebrate, originOf } from "@/lib/celebrate";
import { correctRun } from "@/lib/learningPath";

const CHOICE_LETTERS = "abcdef";

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
  const busyRef = useRef(false);
  const actionRef = useRef(null);
  const visit = useRef(0);
  const startedAt = useRef(Date.now());
  const keyActions = useRef(/** @type {{ choose: (index: number) => boolean, advance: () => void }} */ ({ choose: () => false, advance: () => {} }));

  const questions = attempt?.questions ?? [];
  const question = questions[current];
  const feedback = question?.feedback ?? null;
  const isChecked = Boolean(question?.checked);
  const answerIndex = isChecked ? question.selectedIndex : choices[current];
  const hasAnswer = answerIndex !== undefined && answerIndex !== null;
  const isLast = current === questions.length - 1;
  const optionCount = Math.min(question?.options?.length || 0, CHOICE_LETTERS.length);
  const results = questions.map((item) => (item.checked && item.feedback ? item.feedback.isCorrect : undefined));
  const states = results.map((result) => (result === undefined ? undefined : result ? "done" : "wrong"));
  const run = isChecked && feedback?.isCorrect ? correctRun(results, current) : 0;
  const result = attempt?.result ?? null;
  const submitted = Boolean(result);
  const previousProgress = progress.find((item) => item.moduleNumber === number);
  const sorted = useMemo(() => sortModules(modules), [modules]);
  const module = sorted.find((item) => item.moduleNumber === number);
  const barTitle = module ? module.title : "Kuis modul " + number;
  const barContext = "Kuis · Modul " + number;
  const next = sorted[sorted.findIndex((item) => item.moduleNumber === number) + 1] || null;

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
    busyRef.current = true;
    setBusy(true);
    try {
      const reply = await submit.mutateAsync({ attemptId: attempt.id });
      setDuration(Date.now() - startedAt.current);
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
    } else if (isLast) {
      finish();
    } else {
      setCurrent((value) => value + 1);
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
        if (event.repeat || (target?.closest("button, a") && !target.closest(".aapm-choice"))) return;
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

  if (!validModule || startState === "unavailable" || (!introLoading && !introError && !attempt && introQuestions.length === 0)) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="quiz" title="Kuis belum tersedia" description="Soal untuk modul ini sedang disiapkan oleh admin." action={<Button asChild variant="secondary"><Link to={`/modules/${number}`}><AapmIcon name="arrowLeft" />Kembali ke materi</Link></Button>} />
      </Page>
    );
  }
  if (introError && !attempt) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="error" icon="quiz" title="Pengantar kuis belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<><Button variant="learn" onClick={() => reloadIntro()}>Coba lagi</Button><Button asChild variant="secondary"><Link to={`/modules/${number}`}>Kembali ke materi</Link></Button></>} />
      </Page>
    );
  }
  if (startState === "error") {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="error" icon="quiz" title="Kuis belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<><Button variant="learn" onClick={begin}>Coba lagi</Button><Button asChild variant="secondary"><Link to={`/modules/${number}`}>Kembali ke materi</Link></Button></>} />
      </Page>
    );
  }
  if (!attempt) {
    if (introLoading) return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" />{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</Page>;
    return (
      <FocusShell resetKey="intro" label="Pengantar kuis" bar={<AssessmentBar onExit={exit} title={barTitle} context={barContext} total={introQuestions.length} current={-1} />}>
        <section className="aapm-exam-intro aapm-quiz-intro" aria-labelledby="quiz-intro-title">
          <AppiMascot mood="cheer" size="xl" />
          <p className="aapm-exam-intro__eyebrow">Kuis · Modul {number}</p>
          <h2 id="quiz-intro-title" className="aapm-exam-intro__title">Siap menguji pemahaman?</h2>
          <p className="aapm-exam-intro__text">{barTitle}</p>
          <div className="aapm-quiz-intro__facts">
            <span className="aapm-chip" data-tone="outline"><AapmIcon name="quiz" />{introQuestions.length} soal</span>
            <span className="aapm-chip" data-tone="outline"><AapmIcon name="check" />Umpan balik langsung</span>
          </div>
          <p className="aapm-exam-intro__text">Pilih jawaban, tekan Periksa, lalu baca penjelasannya sebelum lanjut. Jawaban yang sudah diperiksa tetap tersimpan saat Anda kembali.</p>
          {previousProgress?.quizTotal ? <p className="aapm-exam-intro__eyebrow">Skor sebelumnya {Math.round(((previousProgress.quizScore || 0) / previousProgress.quizTotal) * 100)}%</p> : null}
          <div className="aapm-exam-intro__actions">
            <Button variant="learn" size="lg" loading={busy} onClick={begin}>{startState === "loading" ? "Menyiapkan kuis…" : "Mulai kuis"}<AapmIcon name="arrowRight" /></Button>
            <Button asChild variant="secondary" size="lg"><Link to={`/modules/${number}`}><AapmIcon name="lesson" />Baca ulang materi</Link></Button>
          </div>
        </section>
      </FocusShell>
    );
  }

  if (submitted) {
    return (
      <FocusShell resetKey="result" label="Hasil kuis" bar={<AssessmentBar onExit={exit} title={barTitle} context={barContext} total={questions.length} current={questions.length - 1} states={states} />}>
        <AssessmentResult passed={result.passed} score={result.correctAnswers} total={result.totalQuestions} passingGrade={result.passingGrade} duration={duration}>
          <div className="aapm-result-actions">
            {result.passed ? (
              <Button asChild variant="learn" size="lg"><Link to={next ? `/modules/${next.moduleNumber}` : "/modules"}>{next ? "Lanjut ke modul berikutnya" : "Kembali ke jalur belajar"}<AapmIcon name="arrowRight" /></Link></Button>
            ) : (
              <Button variant="learn" size="lg" leadingIcon="refresh" onClick={restart}>Ulangi kuis</Button>
            )}
            {result.passed ? (
              <Button variant="secondary" size="lg" leadingIcon="refresh" onClick={restart}>Ulangi kuis</Button>
            ) : (
              <Button asChild variant="secondary" size="lg"><Link to={`/modules/${number}`}><AapmIcon name="lesson" />Pelajari ulang materi</Link></Button>
            )}
          </div>
          <AnswerReview questions={questions} />
        </AssessmentResult>
      </FocusShell>
    );
  }

  // The action bar keeps its button group last so the same button node moves
  // from Periksa to Lanjut and keyboard focus stays on it.
  return (
    <FocusShell
      resetKey={current}
      label={`Kuis modul ${number}`}
      bar={<AssessmentBar onExit={exit} title={barTitle} context={barContext} total={questions.length} current={current} states={states} />}
      footerTone={isChecked ? (feedback?.isCorrect ? "success" : "danger") : undefined}
      footer={(
        <>
          <p className="aapm-visually-hidden" role="status">{isChecked ? checkAnnouncement(question, feedback, run) : ""}</p>
          {isChecked ? (
            <CheckFeedback question={question} feedback={feedback} run={run} />
          ) : (
            <div className="aapm-focus__footer-group">
              <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} data-hide-label-mobile="" aria-label="Soal sebelumnya">
                <AapmIcon name="arrowLeft" /><span>Sebelumnya</span>
              </Button>
            </div>
          )}
          {isChecked ? null : (
            <p className="aapm-focus__footer-center">
              Pilih dengan <kbd>A</kbd>–<kbd>{CHOICE_LETTERS[optionCount - 1]?.toUpperCase()}</kbd> atau <kbd>1</kbd>–<kbd>{optionCount}</kbd> · <kbd>Enter</kbd> untuk memeriksa
            </p>
          )}
          <div className="aapm-focus__footer-group" ref={actionRef}>
            {!isChecked ? (
              <Button variant="learn" size="lg" disabled={!hasAnswer || busy} onClick={check}>Periksa</Button>
            ) : isLast ? (
              <Button variant="learn" size="lg" loading={busy} onClick={finish}>Lihat hasil<AapmIcon name="arrowRight" /></Button>
            ) : (
              <Button variant="learn" size="lg" onClick={() => setCurrent((value) => value + 1)}>Lanjut<AapmIcon name="arrowRight" /></Button>
            )}
          </div>
        </>
      )}
    >
      <QuizQuestion
        question={question}
        number={current + 1}
        total={questions.length}
        answer={answerIndex}
        revealed={isChecked}
        correctIndex={feedback?.correctIndex}
        onAnswer={(index) => { if (!isChecked) setChoices((value) => ({ ...value, [current]: index })); }}
        meta={previousProgress?.quizTotal ? <span className="aapm-chip" data-tone="outline">Skor sebelumnya {Math.round(((previousProgress.quizScore || 0) / previousProgress.quizTotal) * 100)}%</span> : null}
      />
    </FocusShell>
  );
}
