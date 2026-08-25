import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AssessmentFocusShell from "@/components/layout/AssessmentFocusShell";
import {
  AssessmentProgress,
  AssessmentResult,
  QuestionNavigator,
  QuizQuestion,
} from "@/components/academy/AssessmentComponents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizQuestions, useSaveProgress, useUserProgress } from "@/lib/useCourseData";
import { useToast } from "@/components/ui/use-toast";
import AapmIcon from "@/components/icons/AapmIcon";

export default function Quiz() {
  const { moduleNumber } = useParams();
  const number = Number.parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: questions = [], isLoading } = useQuizQuestions(number);
  const { data: progress = [] } = useUserProgress();
  const saveProgress = useSaveProgress();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const question = questions[current];
  const previousProgress = progress.find((item) => item.moduleNumber === number);
  const answeredCount = Object.keys(answers).length;
  const score = useMemo(() => submitted ? questions.filter((item, index) => answers[index] === item.correctIndex).length : 0, [answers, questions, submitted]);
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= 70;

  const submit = async () => {
    const correct = questions.filter((item, index) => answers[index] === item.correctIndex).length;
    const resultPercent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    setSubmitted(true);
    await save({ moduleNumber: number, data: { moduleNumber: number, completed: true, quizScore: correct, quizTotal: questions.length } });
    toast(resultPercent >= 70 ? { title: "Kuis lulus", description: `Skor ${resultPercent}% tersimpan.` } : { title: "Tinjau materi sebelum mencoba lagi", description: `Skor ${resultPercent}%. Nilai lulus 70%.`, variant: "destructive" });
  };

  const reset = () => { setSubmitted(false); setAnswers({}); setFlagged({}); setCurrent(0); };

  if (isLoading) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!questions.length) return <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning"><AapmIcon name="info" className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Kuis belum tersedia</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Soal untuk modul ini sedang disiapkan oleh admin.</p><Button asChild variant="outline" className="mt-5"><Link to={`/modules/${number}`}><AapmIcon name="arrowLeft" /> Kembali ke lesson</Link></Button></div>;

  if (submitted) {
    return <AssessmentFocusShell header={<div><Link to={`/modules/${number}`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><AapmIcon name="arrowLeft" className="h-3.5 w-3.5" /> Lesson modul {number}</Link><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Assessment result</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Kuis modul {number}</h1></div>}>
      <AssessmentResult passed={passed} score={score} total={questions.length} passingGrade={70} title={passed ? "Pemahaman Anda sudah siap dilanjutkan." : "Beberapa konsep perlu diulang."}><div className="mt-5 flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" onClick={reset}><AapmIcon name="refresh" /> Ulangi kuis</Button><Button type="button" onClick={() => navigate("/modules")}>Kembali ke path <AapmIcon name="arrowRight" /></Button></div></AssessmentResult>
      <Card className="mt-5 shadow-none"><CardContent className="space-y-2 p-4 sm:p-5">{questions.map((item, index) => { const correct = answers[index] === item.correctIndex; return <div key={item.id || index} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><div className={correct ? "text-success" : "text-danger"}>{correct ? <AapmIcon name="checkRead" className="mt-0.5 h-4 w-4" /> : <span className="mt-0.5 block h-4 w-4 text-center text-xs font-bold">{index + 1}</span>}</div><div className="min-w-0"><div className="font-medium">{item.question}</div><div className="mt-1 text-xs text-muted-foreground">{correct ? "Jawaban benar" : `Jawaban benar: ${item.options[item.correctIndex]}`}</div></div></div>; })}</CardContent></Card>
    </AssessmentFocusShell>;
  }

  return <AssessmentFocusShell header={<div><Link to={`/modules/${number}`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><AapmIcon name="arrowLeft" className="h-3.5 w-3.5" /> Lesson modul {number}</Link><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Module assessment</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Kuis modul {number}</h1><p className="mt-1 text-sm text-muted-foreground">Passing grade 70% · Pilih jawaban yang paling tepat.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><AapmIcon name="checkRead" className="h-3.5 w-3.5 text-brand-green" /> {answeredCount}/{questions.length} terjawab</div></div></div>} sidebar={<QuestionNavigator total={questions.length} current={current} answers={answers} flagged={flagged} onSelect={setCurrent} onToggleFlag={(index) => setFlagged((value) => ({ ...value, [index]: !value[index] }))} />}>
    <AssessmentProgress current={current} total={questions.length} label="Progress kuis" />
    <div className="mt-5"><QuizQuestion question={question} answer={answers[current]} onAnswer={(answer) => setAnswers((value) => ({ ...value, [current]: answer }))} /></div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0}><AapmIcon name="arrowLeft" /> Sebelumnya</Button>{current < questions.length - 1 ? <Button type="button" onClick={() => setCurrent((value) => value + 1)} disabled={answers[current] === undefined}>Berikutnya <AapmIcon name="arrowRight" /></Button> : <Button type="button" onClick={submit} disabled={answeredCount < questions.length || saveProgress.isPending}><AapmIcon name="checkRead" /> Submit kuis</Button>}</div>
    {previousProgress?.completed && <div className="mt-4 text-center text-xs text-muted-foreground">Kuis ini sudah pernah disimpan. Anda dapat mengulang untuk memperbarui hasil.</div>}
  </AssessmentFocusShell>;
}
