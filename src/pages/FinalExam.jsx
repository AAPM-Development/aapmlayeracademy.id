import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ConfirmDialog, Skeleton, StateView, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { AssessmentBar, AssessmentResult, QuestionNavigator, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { useAnswerAssessment, useFinalEligibility, useStartAssessment, useSubmitAssessment } from "@/lib/useCourseData";

// Display copy only. The server decides the passing grade (AAPM_FINAL_PASS_PERCENT).
const FINAL_PASSING_GRADE = 80;

/**
 * Final exam in exam mode: no per-question feedback, a question navigator,
 * review flags and an explicit submit confirmation. Eligibility, saved
 * answers, grading and the outcome all come from the server.
 */
export default function FinalExam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: eligibility, isLoading } = useFinalEligibility();
  const start = useStartAssessment();
  const answer = useAnswerAssessment();
  const submitExam = useSubmitAssessment();
  const [attempt, setAttempt] = useState(null);
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Answers are saved one at a time, in the order the learner gave them.
  const saveQueue = useRef(Promise.resolve());

  const questions = attempt?.questions ?? [];
  const question = questions[current];
  const result = attempt?.result ?? null;
  const answers = useMemo(() => Object.fromEntries(
    questions.flatMap((item, index) => (item.selectedIndex === null || item.selectedIndex === undefined ? [] : [[index, item.selectedIndex]])),
  ), [questions]);
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const isLast = current === questions.length - 1;

  const begin = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const reply = await start.mutateAsync({ assessmentType: "final_exam", moduleNumber: 0 });
      setAttempt(reply.attempt);
      setCurrent(0);
      setFlagged({});
    } catch (error) {
      toast({ title: "Ujian belum dapat dimulai", description: error?.message || "Periksa koneksi lalu coba lagi.", variant: "destructive" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const select = (index) => {
    if (!attempt || result || !question) return;
    const item = question;
    const previous = item.selectedIndex;
    setAttempt((value) => ({
      ...value,
      questions: value.questions.map((entry) => (entry.id === item.id ? { ...entry, selectedIndex: index } : entry)),
    }));
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await answer.mutateAsync({ attemptId: attempt.id, questionId: item.id, answerIndex: index });
      } catch (error) {
        setAttempt((value) => ({
          ...value,
          questions: value.questions.map((entry) => (entry.id === item.id ? { ...entry, selectedIndex: previous } : entry)),
        }));
        toast({ title: "Jawaban belum tersimpan", description: error?.message || "Coba pilih lagi.", variant: "destructive" });
      }
    });
  };

  const submit = async () => {
    setConfirmOpen(false);
    if (!attempt || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await saveQueue.current;
      const reply = await submitExam.mutateAsync({ attemptId: attempt.id });
      setAttempt(reply.attempt);
      if (reply.attempt.result?.passed) {
        toast({ title: "Ujian akhir lulus", description: "Hasil sudah tercatat di akun Anda." });
      } else {
        toast({ title: "Belum lulus", description: "Tinjau jalur belajar lalu coba lagi.", variant: "warning" });
      }
    } catch (error) {
      toast({ title: "Hasil belum tersimpan", description: error?.message || "Periksa koneksi lalu coba kirim lagi.", variant: "destructive" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const retry = () => {
    setAttempt(null);
    setCurrent(0);
    begin();
  };
  const exit = () => navigate("/certification");

  if (isLoading) return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 w-full" /></Page>;

  if (result) {
    const passed = Boolean(result.passed);
    return (
      <FocusShell
        resetKey="result"
        label="Hasil ujian akhir"
        bar={<AssessmentBar onExit={exit} title="Ujian akhir" total={questions.length} current={questions.length - 1} states={questions.map((item) => (item.selectedIndex === null ? undefined : "done"))} label="Hasil ujian" />}
      >
        <AssessmentResult
          passed={passed}
          score={result.correctAnswers}
          total={result.totalQuestions}
          passingGrade={result.passingGrade}
          title={passed ? "Anda lulus ujian akhir!" : "Ujian akhir belum lulus"}
          description={passed
            ? "Hasil ini sudah tercatat. Penerbitan sertifikat Expert belum tersedia di halaman ini."
            : "Tinjau materi yang perlu diulang. Pertanyaan dan kunci jawaban tidak ditampilkan pada ujian akhir."}
        >
          {Array.isArray(result.objectives) && result.objectives.length ? (
            <ul className="m-0 mt-4 grid list-none gap-2 p-0">
              {result.objectives.map((item) => (
                <li key={item.learningObjective} className="flex items-center justify-between gap-3 rounded-[var(--aapm-primitive-radius-panel)] bg-[var(--aapm-semantic-surface-subtle)] p-3 text-body">
                  <span className="min-w-0">{item.learningObjective}</span>
                  <span className="tabular-nums">{item.correct}/{item.total}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="aapm-result-actions">
            {passed ? (
              <Button asChild variant="learn" size="lg"><Link to="/certification"><AapmIcon name="certificate" />Lihat status sertifikat</Link></Button>
            ) : (
              <Button variant="learn" size="lg" leadingIcon="refresh" loading={busy} onClick={retry}>Ulangi ujian</Button>
            )}
            <Button asChild variant="secondary" size="lg"><Link to="/modules"><AapmIcon name="roadmap" />Jalur belajar</Link></Button>
          </div>
        </AssessmentResult>
      </FocusShell>
    );
  }

  if (!attempt) {
    const finished = eligibility?.finalStatus === "passed";
    const prerequisitesMissing = eligibility && !eligibility.eligible && !eligibility.activeAttemptId;
    const limitReached = eligibility && eligibility.attemptsRemaining < 1 && !eligibility.activeAttemptId;
    const missing = (eligibility?.missingModuleNumbers ?? []).join(", ");
    let body;
    if (finished) {
      body = <StateView kind="empty" icon="exam" title="Ujian akhir sudah lulus" description="Hasil ujian Anda sudah tercatat." action={<Button asChild variant="secondary"><Link to="/certification"><AapmIcon name="certificate" />Status sertifikat</Link></Button>} />;
    } else if (prerequisitesMissing) {
      body = <StateView kind="empty" icon="roadmap" title="Ujian akhir belum terbuka" description={`Selesaikan kuis atau aktivitas belajar pada modul berikut: ${missing || "—"}.`} action={<Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="arrowLeft" />Jalur belajar</Link></Button>} />;
    } else if (limitReached) {
      body = <StateView kind="empty" icon="exam" title="Batas percobaan tercapai" description={`Coba lagi setelah ${eligibility.nextEligibleAt ? new Date(eligibility.nextEligibleAt).toLocaleString("id-ID") : "beberapa saat"}.`} action={<Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="arrowLeft" />Jalur belajar</Link></Button>} />;
    } else {
      body = (
        <StateView
          kind="empty"
          icon="exam"
          title={eligibility?.activeAttemptId ? "Ujian Anda belum selesai" : "Siap mengikuti ujian akhir?"}
          description={`Nilai lulus ${FINAL_PASSING_GRADE}%.${eligibility?.attemptsRemaining !== undefined ? ` Kesempatan tersisa: ${eligibility.attemptsRemaining} dari ${eligibility.attemptLimit}.` : ""}`}
          action={<Button variant="learn" size="lg" loading={busy} onClick={begin}>{eligibility?.activeAttemptId ? "Lanjutkan ujian" : "Mulai ujian"}</Button>}
        />
      );
    }
    return <Page width="narrow" className="min-h-[60vh] justify-center">{body}</Page>;
  }

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
          title="Ujian akhir"
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
              <Button variant="learn" size="lg" loading={busy} onClick={() => setConfirmOpen(true)}>Kirim ujian</Button>
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
        onAnswer={select}
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
