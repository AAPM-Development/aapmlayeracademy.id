import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import AssessmentFocusShell from "@/components/layout/AssessmentFocusShell";
import { AssessmentProgress, AssessmentResult, QuestionNavigator, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizQuestions, useIssueCertificate, useSaveProgress } from "@/lib/useCourseData";
import { useToast } from "@/components/ui/use-toast";
import AapmIcon from "@/components/icons/AapmIcon";

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
  if (!questions.length) return <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning"><AapmIcon name="alertCircle" className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Ujian akhir belum tersedia</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Belum ada soal ujian akhir pada data Academy.</p><Button asChild variant="outline" className="mt-5"><Link to="/modules"><AapmIcon name="arrowLeft" /> Kembali ke jalur belajar</Link></Button></div>;

  const header = <div className="overflow-hidden rounded-[var(--card-radius)] border border-brand-green/30 bg-brand-green text-white"><div className="h-1 bg-brand-lime" /><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="flex items-start gap-3"><AppBrand product="academy" variant="icon" mode="dark" className="h-9 w-9 shrink-0" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-lime">Mode fokus evaluasi</div><h1 className="mt-2 text-xl font-semibold sm:text-2xl">Ujian akhir · Progres profesional</h1><p className="mt-2 text-sm leading-6 text-white/70">{questions.length} soal dari data Academy saat ini · Nilai lulus {FINAL_PASSING_GRADE}%</p></div></div><div className="flex items-center gap-2 text-xs text-white/70"><AapmIcon name="graduation" className="h-4 w-4 text-brand-lime" /> Tingkat 6</div></div></div>;

  if (submitted) return <AssessmentFocusShell header={header}><AssessmentResult passed={passed} score={score} total={questions.length} passingGrade={FINAL_PASSING_GRADE} title={passed ? "Anda lulus ujian akhir." : "Ujian akhir belum lulus."}><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{passed ? "Progress tingkat ahli tersimpan dan sertifikat diterbitkan melalui proses yang sama." : "Gunakan hasil ini untuk memilih materi yang perlu Anda ulangi."}</p><div className="mt-6 flex flex-wrap justify-center gap-2">{passed && <Button asChild><Link to="/certification"><AapmIcon name="award" /> Lihat sertifikasi</Link></Button>}<Button type="button" variant="outline" onClick={reset}><AapmIcon name="refresh" /> Ulangi ujian</Button><Button type="button" variant="outline" onClick={() => navigate("/modules")}>Jalur belajar <AapmIcon name="arrowRight" /></Button></div></AssessmentResult></AssessmentFocusShell>;

  return <AssessmentFocusShell header={<><Link to="/certification" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><AapmIcon name="arrowLeft" className="h-3.5 w-3.5" /> Certification</Link>{header}</>} sidebar={<QuestionNavigator total={questions.length} current={current} answers={answers} flagged={flagged} onSelect={setCurrent} onToggleFlag={(index) => setFlagged((value) => ({ ...value, [index]: !value[index] }))} />}>
    <AssessmentProgress current={current} total={questions.length} label="Progress Final Exam" />
    <div className="mt-5"><QuizQuestion question={question} number={current + 1} total={questions.length} answer={answers[current]} onAnswer={(answer) => setAnswers((value) => ({ ...value, [current]: answer }))} /></div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0}><AapmIcon name="arrowLeft" /> Sebelumnya</Button>{current < questions.length - 1 ? <Button type="button" onClick={() => setCurrent((value) => value + 1)} disabled={answers[current] === undefined}>Simpan & lanjut <AapmIcon name="arrowRight" /></Button> : <Button type="button" onClick={submit} disabled={answeredCount < questions.length || saveProgress.isPending || issue.isPending}><AapmIcon name="checkRead" /> Periksa & kirim</Button>}</div>
    <div className="mt-4 text-center text-xs leading-5 text-muted-foreground">Semua jawaban harus terisi sebelum dikirim. Jumlah soal mengikuti data terbaru dari Academy.</div>
  </AssessmentFocusShell>;
}
