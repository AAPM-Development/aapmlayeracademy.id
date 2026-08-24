import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Award, CheckCircle2, GraduationCap, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import AssessmentFocusShell from "@/components/layout/AssessmentFocusShell";
import { AssessmentProgress, AssessmentResult, QuestionNavigator, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizQuestions, useIssueCertificate, useSaveProgress } from "@/lib/useCourseData";
import { useToast } from "@/components/ui/use-toast";

const FINAL_PASSING_GRADE = 80;

export default function FinalExam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: questions = [], isLoading } = useQuizQuestions(0);
  const saveProgress = useSaveProgress();
  const issue = useIssueCertificate();
  const save = /** @type {any} */ (saveProgress.mutateAsync);
  const issueCertificate = /** @type {any} */ (issue.mutateAsync);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const score = useMemo(() => submitted ? questions.filter((item, index) => answers[index] === item.correctIndex).length : 0, [answers, questions, submitted]);
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= FINAL_PASSING_GRADE;

  const submit = async () => {
    const correct = questions.filter((item, index) => answers[index] === item.correctIndex).length;
    const resultPercent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const resultPassed = resultPercent >= FINAL_PASSING_GRADE;
    setSubmitted(true);
    await save({ moduleNumber: 0, data: { moduleNumber: 0, completed: resultPassed, quizScore: correct, quizTotal: questions.length } });
    if (resultPassed) {
      await issueCertificate({ levelNumber: 6, levelName: "Layer Poultry Farm Expert", score: resultPercent, examType: "final", holderName: "Peserta Layer Farm Academy" });
      toast({ title: "Final Exam lulus", description: "Sertifikat Expert telah diterbitkan." });
    } else {
      toast({ title: "Belum lulus", description: "Review learning path lalu coba lagi.", variant: "destructive" });
    }
  };

  const reset = () => { setSubmitted(false); setAnswers({}); setFlagged({}); setCurrent(0); };

  if (isLoading) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!questions.length) return <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning"><AlertCircle className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Final Exam belum tersedia</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Belum ada soal final exam pada data Academy.</p><Button asChild variant="outline" className="mt-5"><Link to="/modules"><ArrowLeft /> Kembali ke path</Link></Button></div>;

  const header = <div className="rounded-2xl border border-border bg-foreground p-5 text-background sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><AppBrand product="academy" variant="icon" mode="dark" className="h-9 w-9 shrink-0" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Assessment focus mode</div><h1 className="mt-2 text-xl font-semibold sm:text-2xl">Final Exam · Professional progression</h1><p className="mt-2 text-sm leading-6 text-background/65">{questions.length} soal dari source of truth saat ini · Passing grade {FINAL_PASSING_GRADE}%</p></div></div><div className="hidden items-center gap-2 text-xs text-background/60 sm:flex"><GraduationCap className="h-4 w-4 text-brand-orange" /> Tier 6</div></div></div>;

  if (submitted) return <AssessmentFocusShell header={header}><AssessmentResult passed={passed} score={score} total={questions.length} passingGrade={FINAL_PASSING_GRADE} title={passed ? "Anda lulus Final Exam." : "Final Exam belum lulus."}><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{passed ? "Progress Expert tersimpan dan sertifikat diterbitkan melalui proses yang sama." : "Gunakan hasil ini untuk memilih lesson yang perlu Anda ulangi."}</p><div className="mt-6 flex flex-wrap justify-center gap-2">{passed && <Button asChild className="bg-brand-green text-white hover:bg-brand-green/90"><Link to="/certification"><Award /> Lihat certification</Link></Button>}<Button type="button" variant="outline" onClick={reset}><RotateCcw /> Ulangi exam</Button><Button type="button" variant="outline" onClick={() => navigate("/modules")}>Learning Path <ArrowRight /></Button></div></AssessmentResult></AssessmentFocusShell>;

  return <AssessmentFocusShell header={<><Link to="/certification" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Certification</Link>{header}</>} sidebar={<QuestionNavigator total={questions.length} current={current} answers={answers} flagged={flagged} onSelect={setCurrent} onToggleFlag={(index) => setFlagged((value) => ({ ...value, [index]: !value[index] }))} />}>
    <AssessmentProgress current={current} total={questions.length} label="Exam progress" />
    <div className="mt-5"><QuizQuestion question={question} answer={answers[current]} onAnswer={(answer) => setAnswers((value) => ({ ...value, [current]: answer }))} /></div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0}><ArrowLeft /> Sebelumnya</Button>{current < questions.length - 1 ? <Button type="button" onClick={() => setCurrent((value) => value + 1)} disabled={answers[current] === undefined} className="bg-brand-orange text-white hover:bg-brand-orange/90">Save & next <ArrowRight /></Button> : <Button type="button" onClick={submit} disabled={answeredCount < questions.length || saveProgress.isPending || issue.isPending} className="bg-brand-green text-white hover:bg-brand-green/90"><CheckCircle2 /> Review & submit</Button>}</div>
    <div className="mt-4 text-center text-xs text-muted-foreground">Semua jawaban harus terisi sebelum submit. Question count mengikuti data yang dikembalikan API.</div>
  </AssessmentFocusShell>;
}
