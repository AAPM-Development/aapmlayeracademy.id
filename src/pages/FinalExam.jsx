import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ConfirmDialog, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { AnswerReview, AssessmentBar, AssessmentResult, QuestionNavigator, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { useIssueCertificate, useQuizQuestions, useSaveProgress } from "@/lib/useCourseData";

const FINAL_PASSING_GRADE = 80;

/**
 * Final exam in exam mode: no per-question feedback, a question navigator,
 * review flags and an explicit submit confirmation.
 */
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const score = useMemo(() => questions.filter((item, index) => answers[index] === item.correctIndex).length, [answers, questions]);
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = percent >= FINAL_PASSING_GRADE;

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitted(true);
    try {
      await save({ moduleNumber: 0, data: { moduleNumber: 0, completed: passed, quizScore: score, quizTotal: questions.length } });
      if (passed) {
        await issueCertificate({ levelNumber: 6, levelName: "Layer Poultry Farm Expert", score: percent, examType: "final", holderName: "Peserta Layer Farm Academy" });
        toast({ title: "Ujian akhir lulus", description: "Sertifikat Expert telah diterbitkan." });
      } else {
        toast({ title: "Belum lulus", description: "Tinjau jalur belajar lalu coba lagi.", variant: "warning" });
      }
    } catch {
      toast({ title: "Hasil belum tersimpan", description: "Periksa koneksi lalu kirim ulang ujian.", variant: "destructive" });
    }
  };

  const reset = () => { setSubmitted(false); setAnswers({}); setFlagged({}); setCurrent(0); };
  const exit = () => navigate("/certification");

  if (isLoading) return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 w-full" /></Page>;
  if (!questions.length) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="exam" title="Ujian akhir belum tersedia" description="Belum ada soal ujian akhir pada data Academy." action={<Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="arrowLeft" />Kembali ke jalur belajar</Link></Button>} />
      </Page>
    );
  }

  if (submitted) {
    return (
      <FocusShell resetKey="result" label="Hasil ujian akhir" bar={<AssessmentBar onExit={exit} total={questions.length} current={questions.length - 1} states={questions.map((item, index) => (answers[index] === item.correctIndex ? "done" : "wrong"))} label="Hasil ujian" />}>
        <AssessmentResult
          passed={passed}
          score={score}
          total={questions.length}
          passingGrade={FINAL_PASSING_GRADE}
          title={passed ? "Anda lulus ujian akhir!" : "Ujian akhir belum lulus"}
          description={passed ? "Sertifikat Layer Poultry Farm Expert diterbitkan ke akun Anda." : "Gunakan hasil ini untuk memilih materi yang perlu diulang."}
        >
          <div className="aapm-result-actions">
            {passed ? (
              <Button asChild variant="learn" size="lg"><Link to="/certification"><AapmIcon name="certificate" />Lihat sertifikat</Link></Button>
            ) : (
              <Button variant="learn" size="lg" leadingIcon="refresh" onClick={reset}>Ulangi ujian</Button>
            )}
            <Button asChild variant="secondary" size="lg"><Link to="/modules"><AapmIcon name="roadmap" />Jalur belajar</Link></Button>
          </div>
          <AnswerReview questions={questions} answers={answers} />
        </AssessmentResult>
      </FocusShell>
    );
  }

  const isLast = current === questions.length - 1;
  const navigator = (
    <QuestionNavigator total={questions.length} current={current} answers={answers} flagged={flagged} onSelect={setCurrent} />
  );

  return (
    <FocusShell
      resetKey={current}
      label="Ujian akhir"
      outline={navigator}
      bar={(
        <AssessmentBar
          onExit={exit}
          total={questions.length}
          current={current}
          states={questions.map((_, index) => (answers[index] !== undefined ? "done" : undefined))}
          label="Progress ujian akhir"
        />
      )}
      footer={(
        <>
          <div className="aapm-focus__footer-group">
            <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} data-hide-label-mobile="" aria-label="Soal sebelumnya">
              <AapmIcon name="arrowLeft" /><span>Sebelumnya</span>
            </Button>
            <Button
              variant="ghost"
              aria-pressed={Boolean(flagged[current])}
              aria-label={flagged[current] ? "Batal tandai soal" : "Tandai soal untuk ditinjau"}
              onClick={() => setFlagged((value) => ({ ...value, [current]: !value[current] }))}
              data-hide-label-mobile=""
            >
              <AapmIcon name="flag" /><span>{flagged[current] ? "Batal tandai" : "Tandai"}</span>
            </Button>
          </div>
          <p className="aapm-focus__footer-center">{answeredCount}/{questions.length} terjawab · nilai lulus {FINAL_PASSING_GRADE}%</p>
          <div className="aapm-focus__footer-group">
            {isLast ? (
              <Button variant="learn" size="lg" loading={saveProgress.isPending || issue.isPending} onClick={() => setConfirmOpen(true)}>Kirim ujian</Button>
            ) : (
              <Button variant="learn" size="lg" onClick={() => setCurrent((value) => value + 1)}>Berikutnya<AapmIcon name="arrowRight" /></Button>
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
        onAnswer={(answer) => setAnswers((value) => ({ ...value, [current]: answer }))}
        meta={<span className="aapm-chip" data-tone="attention">Ujian akhir · Tingkat 6</span>}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon="exam"
        title={answeredCount < questions.length ? `${questions.length - answeredCount} soal belum dijawab` : "Kirim ujian akhir?"}
        description={answeredCount < questions.length
          ? "Semua soal harus dijawab sebelum ujian dapat dikirim. Gunakan daftar soal untuk menemukan yang masih kosong."
          : flaggedCount ? `${flaggedCount} soal masih ditandai untuk ditinjau. Jawaban tidak dapat diubah setelah dikirim.` : "Jawaban tidak dapat diubah setelah dikirim."}
        confirmLabel={answeredCount < questions.length ? "Mengerti" : "Kirim sekarang"}
        cancelLabel="Tinjau lagi"
        onConfirm={answeredCount < questions.length
          ? () => { setConfirmOpen(false); setCurrent(questions.findIndex((_, index) => answers[index] === undefined)); }
          : submit}
      />
    </FocusShell>
  );
}
