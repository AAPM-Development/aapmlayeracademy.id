import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { AnswerFeedback, AnswerReview, AssessmentBar, AssessmentResult, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { useModules, useQuizQuestions, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { sortModules } from "@/lib/academyData";

const PASSING_GRADE = 70;

/**
 * Module quiz, one question per screen: choose → check → feedback →
 * continue. Scoring and the saved progress contract are unchanged.
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
  const question = questions[current];
  const previousProgress = progress.find((item) => item.moduleNumber === number);
  const sorted = useMemo(() => sortModules(modules), [modules]);
  const module = sorted.find((item) => item.moduleNumber === number);
  const quizTitle = module ? "Kuis · " + module.title : "Kuis modul " + number;
  const next = sorted[sorted.findIndex((item) => item.moduleNumber === number) + 1] || null;
  const score = useMemo(() => questions.filter((item, index) => answers[index] === item.correctIndex).length, [answers, questions]);
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= PASSING_GRADE;
  const states = questions.map((item, index) => (checked[index] ? (answers[index] === item.correctIndex ? "done" : "wrong") : undefined));

  const submit = async () => {
    setSubmitted(true);
    try {
      await save({ moduleNumber: number, data: { moduleNumber: number, completed: passed || Boolean(previousProgress?.completed), quizScore: score, quizTotal: questions.length } });
      toast(percent >= PASSING_GRADE
        ? { title: "Kuis lulus", description: `Skor ${percent}% tersimpan.` }
        : { title: "Tinjau materi sebelum mencoba lagi", description: `Skor ${percent}%. Nilai lulus ${PASSING_GRADE}%.`, variant: "warning" });
    } catch {
      toast({ title: "Hasil belum tersimpan", description: "Periksa koneksi lalu ulangi kuis.", variant: "destructive" });
    }
  };

  const reset = () => { setSubmitted(false); setAnswers({}); setChecked({}); setCurrent(0); };
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
      <FocusShell resetKey="result" label="Hasil kuis" bar={<AssessmentBar onExit={exit} title={quizTitle} total={questions.length} current={questions.length - 1} states={questions.map((item, index) => (answers[index] === item.correctIndex ? "done" : "wrong"))} />}>
        <AssessmentResult passed={passed} score={score} total={questions.length} passingGrade={PASSING_GRADE}>
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

  const isChecked = Boolean(checked[current]);
  const hasAnswer = answers[current] !== undefined;
  const isLast = current === questions.length - 1;

  return (
    <FocusShell
      resetKey={current}
      label={`Kuis modul ${number}`}
      bar={<AssessmentBar onExit={exit} title={quizTitle} total={questions.length} current={current} states={states} />}
      footer={(
        <>
          <div className="aapm-focus__footer-group">
            <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} data-hide-label-mobile="" aria-label="Soal sebelumnya">
              <AapmIcon name="arrowLeft" /><span>Sebelumnya</span>
            </Button>
          </div>
          <p className="aapm-focus__footer-center">{module ? `Kuis · ${module.title}` : `Kuis modul ${number}`}</p>
          <div className="aapm-focus__footer-group">
            {!isChecked ? (
              <Button variant="learn" size="lg" disabled={!hasAnswer} onClick={() => setChecked((value) => ({ ...value, [current]: true }))}>Periksa</Button>
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
      >
        {isChecked ? <AnswerFeedback question={question} answer={answers[current]} /> : null}
      </QuizQuestion>
    </FocusShell>
  );
}
