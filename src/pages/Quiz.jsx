import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { AnswerReview, AssessmentBar, AssessmentResult, CheckFeedback, QuizQuestion, checkAnnouncement } from "@/components/academy/AssessmentComponents";
import { useAnswerAssessment, useModules, useStartAssessment, useSubmitAssessment, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";
import { celebrate } from "@/lib/celebrate";
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
  const startedFor = useRef(null);
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
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStartState("loading");
    try {
      const reply = await start.mutateAsync({ assessmentType: "module_quiz", moduleNumber: number });
      const open = reply.attempt.questions.findIndex((item) => !item.checked);
      setAttempt(reply.attempt);
      setChoices({});
      setCurrent(open === -1 ? Math.max(0, reply.attempt.questions.length - 1) : open);
      startedAt.current = Date.now();
      setStartState("ready");
    } catch (error) {
      if (error?.code === "assessment_unavailable" || error?.code === "assessment_not_found") {
        setStartState("unavailable");
      } else {
        setStartState("error");
        toast({ title: "Kuis belum dapat dimulai", description: error?.message || "Periksa koneksi lalu coba lagi.", variant: "destructive" });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // One attempt per visit: the server resumes an open attempt instead of
  // creating another, so a re-render or a reload never grants a new try.
  useEffect(() => {
    if (!Number.isFinite(number) || startedFor.current === number) return;
    startedFor.current = number;
    setAttempt(null);
    setCurrent(0);
    setChoices({});
    begin();
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
      if (reply.attempt.result?.passed) celebrate();
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
    if (submitted) return undefined;
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
  }, [submitted]);

  const restart = () => {
    setAttempt(null);
    setChoices({});
    setCurrent(0);
    begin();
  };
  const exit = () => navigate(`/modules/${number}`);

  if (startState === "unavailable") {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="quiz" title="Kuis belum tersedia" description="Soal untuk modul ini sedang disiapkan oleh admin." action={<Button asChild variant="secondary"><Link to={`/modules/${number}`}><AapmIcon name="arrowLeft" />Kembali ke materi</Link></Button>} />
      </Page>
    );
  }
  if (startState === "error") {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="quiz" title="Kuis belum dapat dimuat" description="Periksa koneksi lalu coba lagi." action={<Button variant="learn" onClick={begin}>Coba lagi</Button>} />
      </Page>
    );
  }
  if (!attempt) {
    return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" />{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</Page>;
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
          <div className="aapm-focus__footer-group">
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
