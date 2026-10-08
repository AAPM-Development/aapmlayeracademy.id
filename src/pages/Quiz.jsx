import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { AnswerReview, AssessmentBar, AssessmentResult, CheckFeedback, QuizQuestion, checkAnnouncement } from "@/components/academy/AssessmentComponents";
import { useModules, useQuizQuestions, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";
import { celebrate } from "@/lib/celebrate";
import { correctRun } from "@/lib/learningPath";

const PASSING_GRADE = 70;
const CHOICE_LETTERS = "abcdef";

/**
 * Module quiz, one question per screen (Duolingo-style): choose → Periksa →
 * the action bar turns into the verdict → Lanjut. A–F or 1–6 pick a choice
 * and Enter checks or continues. Scoring and the saved progress contract are
 * unchanged.
 */
export default function Quiz() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: questions = [], isLoading } = useQuizQuestions(number);
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const saveProgress = useSaveProgress();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [duration, setDuration] = useState(0);
  const startedAt = useRef(Date.now());
  const keyActions = useRef(/** @type {{ choose: (index: number) => boolean, advance: () => void }} */ ({ choose: () => false, advance: () => {} }));
  const question = questions[current];
  const previousProgress = progress.find((item) => item.moduleNumber === number);
  const sorted = useMemo(() => sortModules(modules), [modules]);
  const module = sorted.find((item) => item.moduleNumber === number);
  const barTitle = module ? module.title : "Kuis modul " + number;
  const barContext = "Kuis · Modul " + number;
  const next = sorted[sorted.findIndex((item) => item.moduleNumber === number) + 1] || null;
  const score = useMemo(() => questions.filter((item, index) => answers[index] === item.correctIndex).length, [answers, questions]);
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= PASSING_GRADE;
  const results = questions.map((item, index) => (checked[index] ? answers[index] === item.correctIndex : undefined));
  const states = results.map((result) => (result === undefined ? undefined : result ? "done" : "wrong"));

  const isChecked = Boolean(checked[current]);
  const hasAnswer = answers[current] !== undefined;
  const isLast = current === questions.length - 1;
  const correct = isChecked && answers[current] === question?.correctIndex;
  const run = correct ? correctRun(results, current) : 0;
  const optionCount = Math.min(question?.options?.length || 0, CHOICE_LETTERS.length);

  // Time on the quiz starts when the questions are on screen.
  useEffect(() => {
    if (questions.length) startedAt.current = Date.now();
  }, [questions.length]);

  const submit = async () => {
    setDuration(Date.now() - startedAt.current);
    setSubmitted(true);
    try {
      await save({ moduleNumber: number, data: { moduleNumber: number, completed: passed || Boolean(previousProgress?.completed), quizScore: score, quizTotal: questions.length } });
      // The result screen is the feedback; a toast would repeat it over the bar.
      if (passed) celebrate();
    } catch {
      toast({ title: "Hasil belum tersimpan", description: "Periksa koneksi lalu ulangi kuis.", variant: "destructive" });
    }
  };

  const check = () => setChecked((value) => ({ ...value, [current]: true }));
  const advance = () => {
    if (submitted || !question) return;
    if (!isChecked) {
      if (hasAnswer) check();
    } else if (isLast) {
      if (!saveProgress.isPending) submit();
    } else {
      setCurrent((value) => value + 1);
    }
  };
  keyActions.current = {
    choose: (index) => {
      if (!question || isChecked || index >= optionCount) return false;
      setAnswers((value) => ({ ...value, [current]: index }));
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

  const reset = () => {
    setSubmitted(false);
    setAnswers({});
    setChecked({});
    setCurrent(0);
    startedAt.current = Date.now();
  };
  const exit = () => navigate(`/modules/${number}`);

  if (isLoading) {
    return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" />{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</Page>;
  }
  if (!questions.length) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="quiz" title="Kuis belum tersedia" description="Soal untuk modul ini sedang disiapkan oleh admin." action={<Button asChild variant="secondary"><Link to={`/modules/${number}`}><AapmIcon name="arrowLeft" />Kembali ke materi</Link></Button>} />
      </Page>
    );
  }

  if (submitted) {
    return (
      <FocusShell resetKey="result" label="Hasil kuis" bar={<AssessmentBar onExit={exit} title={barTitle} context={barContext} total={questions.length} current={questions.length - 1} states={questions.map((item, index) => (answers[index] === item.correctIndex ? "done" : "wrong"))} />}>
        <AssessmentResult passed={passed} score={score} total={questions.length} passingGrade={PASSING_GRADE} duration={duration}>
          <div className="aapm-result-actions">
            {passed ? (
              <Button asChild variant="learn" size="lg"><Link to={next ? `/modules/${next.moduleNumber}` : "/modules"}>{next ? "Lanjut ke modul berikutnya" : "Kembali ke jalur belajar"}<AapmIcon name="arrowRight" /></Link></Button>
            ) : (
              <Button variant="learn" size="lg" leadingIcon="refresh" onClick={reset}>Ulangi kuis</Button>
            )}
            {passed ? (
              <Button variant="secondary" size="lg" leadingIcon="refresh" onClick={reset}>Ulangi kuis</Button>
            ) : (
              <Button asChild variant="secondary" size="lg"><Link to={`/modules/${number}`}><AapmIcon name="lesson" />Pelajari ulang materi</Link></Button>
            )}
          </div>
          <AnswerReview questions={questions} answers={answers} />
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
      footerTone={isChecked ? (correct ? "success" : "danger") : undefined}
      footer={(
        <>
          <p className="aapm-visually-hidden" role="status">{isChecked ? checkAnnouncement(question, answers[current], run) : ""}</p>
          {isChecked ? (
            <CheckFeedback question={question} answer={answers[current]} run={run} />
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
              <Button variant="learn" size="lg" disabled={!hasAnswer} onClick={check}>Periksa</Button>
            ) : isLast ? (
              <Button variant="learn" size="lg" loading={saveProgress.isPending} onClick={submit}>Lihat hasil<AapmIcon name="arrowRight" /></Button>
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
        answer={answers[current]}
        revealed={isChecked}
        onAnswer={(answer) => setAnswers((value) => ({ ...value, [current]: answer }))}
        meta={previousProgress?.quizTotal ? <span className="aapm-chip" data-tone="outline">Skor sebelumnya {Math.round(((previousProgress.quizScore || 0) / previousProgress.quizTotal) * 100)}%</span> : null}
      />
    </FocusShell>
  );
}
