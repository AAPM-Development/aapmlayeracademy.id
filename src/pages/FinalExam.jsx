import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, Sheet, SheetContent, SheetDescription, SheetTitle, Skeleton, useToast } from "@/design-system";
import { FocusShell, Page } from "@/design-system/patterns/AppShell";
import { Bar, Egg, Ic } from "@/design-system/canvas";
import AppiMascot from "@/components/appi/AppiMascot";
import { AssessmentBar, AssessmentResult, QuestionNavigator, QuizQuestion } from "@/components/academy/AssessmentComponents";
import { useAnswerAssessment, useFinalEligibility, useModules, useStartAssessment, useSubmitAssessment, useUserProgress } from "@/lib/useCourseData";
import { getCompletedModuleSet, getNextModule, sortModules } from "@/lib/academyData";

const EXAM_TITLE = "Sertifikasi Tingkat 6 · Layer Poultry Farm Expert";

/** The 22-egg grid of required modules: verified, being studied, not started. */
function RequirementEggs({ modules, completedSet, currentNumber, missing }) {
  const missingSet = new Set(missing);
  return (
    <>
      <div className="scroll-x pulse-room">
        <ol className="exam-eggs" aria-label={`${modules.length} modul wajib`}>
          {modules.map((module) => {
            const done = completedSet.has(module.moduleNumber) && !missingSet.has(module.moduleNumber);
            const current = !done && module.moduleNumber === currentNumber;
            return (
              <li key={module.moduleNumber}>
                {done ? (
                  <Egg size="xs" state="done"><Ic name="check" /><span className="sr-only">Modul {module.moduleNumber} terverifikasi</span></Egg>
                ) : current ? (
                  <Egg size="xs" state="current" className="anim-pulse" aria-current="step">{module.moduleNumber}<span className="sr-only">, sedang dipelajari</span></Egg>
                ) : (
                  <Egg size="xs">{module.moduleNumber}</Egg>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="row wrap gap-4">
        <span className="legend" data-hue="green"><i />Terverifikasi</span>
        <span className="legend" data-hue="ai"><i />Sedang dipelajari</span>
        <span className="legend" data-hue="neutral"><i style={{ background: "var(--surface-3)" }} />Belum dimulai</span>
      </div>
    </>
  );
}

/**
 * Final exam in exam mode (canvas "Ujian akhir"): the intro with its
 * requirements, the exam with a question navigator, review flags and an
 * explicit submit confirmation, and the result. Eligibility, saved answers,
 * grading and the outcome all come from the server.
 */
export default function FinalExam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: eligibility, isLoading } = useFinalEligibility();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const start = useStartAssessment();
  const answer = useAnswerAssessment();
  const submitExam = useSubmitAssessment();
  const [attempt, setAttempt] = useState(null);
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Answers are saved one at a time, in the order the learner gave them.
  const saveQueue = useRef(Promise.resolve());

  const passGrade = eligibility?.finalPassPercent ?? 80;
  const questions = attempt?.questions ?? [];
  const question = questions[current];
  const result = attempt?.result ?? null;
  const answers = useMemo(() => Object.fromEntries(
    questions.flatMap((item, index) => (item.selectedIndex === null || item.selectedIndex === undefined ? [] : [[index, item.selectedIndex]])),
  ), [questions]);
  const answeredCount = Object.keys(answers).length;
  const flaggedIndexes = Object.entries(flagged).filter(([, value]) => value).map(([key]) => Number(key));
  const isLast = current === questions.length - 1;
  const sortedModules = useMemo(() => sortModules(modules), [modules]);
  const completedSet = useMemo(() => getCompletedModuleSet(progress, modules), [progress, modules]);

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

  if (isLoading) return <Page width="narrow"><Skeleton style={{ height: 12 }} /><Skeleton style={{ height: 40, width: "75%" }} /><Skeleton style={{ height: 256 }} /></Page>;

  if (result) {
    const passed = Boolean(result.passed);
    return (
      <FocusShell
        resetKey="result"
        label="Hasil ujian akhir"
        bar={(
          <header className="focus-bar">
            <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label="Tutup hasil dan buka halaman Sertifikasi" onClick={exit}><Ic name="x" /></button>
            <span className="vr" style={{ margin: "14px 4px" }} />
            <div className="stack grow" style={{ minWidth: 0 }}>
              <span className="t-caption t-muted t-clamp-1">Hasil ujian akhir</span>
              <span className="t-heading t-clamp-1">{EXAM_TITLE}</span>
            </div>
            <span className="chip chip-lg chip-success hide-sm"><Ic name="check-circle" />Tercatat</span>
          </header>
        )}
      >
        <div className="quiz-result">
          <AssessmentResult
            passed={passed}
            score={result.correctAnswers}
            total={result.totalQuestions}
            passingGrade={result.passingGrade}
            hue={passed ? "gold" : undefined}
            badge={passed ? <span className="medal anim-pop exam-medal" data-hue="gold" role="img" aria-label="Medali Tingkat 6" style={{ "--i": 2 }}><span className="t-metric">6</span></span> : null}
            title={passed ? "Anda lulus ujian akhir!" : "Ujian akhir belum lulus"}
            description={passed
              ? "Hasil lulus sudah tercatat. Klaim sertifikat Expert di halaman Sertifikasi."
              : "Tinjau materi yang perlu diulang. Pertanyaan dan kunci jawaban tidak ditampilkan pada ujian akhir."}
          >
            {Array.isArray(result.objectives) && result.objectives.length ? (
              <section className="card anim-rise" style={{ "--i": 4 }} aria-labelledby="obj-title">
                <div className="card-pad card-head" style={{ paddingBottom: "var(--s-3)" }}>
                  <div className="stack gap-0-5">
                    <h2 className="card-title" id="obj-title">Hasil per tujuan belajar</h2>
                    <p className="card-desc">Kunci jawaban ujian akhir tidak ditampilkan; gunakan ringkasan ini untuk memilih materi yang perlu diulas.</p>
                  </div>
                </div>
                <ul className="list">
                  {result.objectives.map((item, index) => {
                    const percent = item.total ? Math.round((item.correct / item.total) * 100) : 0;
                    const full = item.correct === item.total;
                    return (
                      <li key={item.learningObjective} className="li" data-hue={full ? "green" : "amber"}>
                        <span className="t-body t-medium grow">{item.learningObjective}</span>
                        <Bar value={percent} size="sm" animate index={index + 1} style={{ width: 96 }} />
                        <span className="t-support t-strong t-num t-right" style={{ width: 32 }}>{item.correct}/{item.total}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {passed ? (
              <div className="reward wrap anim-rise" data-hue="gold" style={{ "--i": 5 }}>
                <span className="xp xp-lg anim-pop" style={{ "--i": 5 }}><Ic name="star" />+150 poin</span>
                <div className="stack" style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <span className="t-heading">Poin sertifikat setelah diklaim</span>
                  <span className="t-caption t-muted">{EXAM_TITLE}</span>
                </div>
              </div>
            ) : null}
            <div className="row wrap justify-center gap-3">
              {passed ? (
                <Link className="btn btn-gold btn-lg shine btn-block-sm" to="/certification"><Ic name="award" />Klaim sertifikat Expert</Link>
              ) : (
                <button type="button" className="btn btn-learn btn-lg btn-block-sm" disabled={busy} onClick={retry}><Ic name="refresh" />Ulangi ujian</button>
              )}
              <Link className="btn btn-secondary btn-lg btn-block-sm" to="/modules"><Ic name="route" />Jalur belajar</Link>
            </div>
          </AssessmentResult>
        </div>
      </FocusShell>
    );
  }

  if (!attempt) {
    const finished = eligibility?.finalStatus === "passed";
    const resume = Boolean(eligibility?.activeAttemptId);
    const ready = Boolean(eligibility?.eligible) || resume;
    const required = eligibility?.requiredCount || sortedModules.length;
    const verified = eligibility?.verifiedCompletedCount ?? completedSet.size;
    const percent = required ? Math.round((verified / required) * 100) : 0;
    const next = getNextModule(modules, progress);
    const intro = finished
      ? { mood: "proud", title: "Ujian akhir sudah lulus", text: "Hasil ujian Anda sudah tercatat. Lihat status sertifikat Expert Anda." }
      : ready
        ? { mood: resume ? "talk" : "wink", title: resume ? "Ujian Anda belum selesai" : "Siap mengikuti ujian akhir?", text: "Semua modul wajib terverifikasi. Jawab semua soal lalu kirim; hasil lulus sebelumnya tetap tersimpan." }
        : { mood: "curious", title: "Persiapkan sertifikasi sesuai ritme Anda", text: `Untuk sertifikasi Expert, selesaikan dan verifikasi semua modul wajib. Materi dan kuis bisa dibuka dalam urutan pilihan Anda, serta diulang kapan saja.` };
    return (
      <FocusShell
        resetKey="intro"
        label="Pengantar ujian akhir"
        bar={(
          <header className="focus-bar">
            <Link className="btn btn-ghost btn-icon btn-quiet" to="/" aria-label="Tutup dan kembali ke beranda"><Ic name="x" /></Link>
            <span className="vr" style={{ margin: "14px 4px" }} />
            <div className="stack grow" style={{ minWidth: 0 }}>
              <span className="t-caption t-muted t-clamp-1">Ujian akhir</span>
              <span className="t-heading t-clamp-1">{EXAM_TITLE}</span>
            </div>
            {finished ? <span className="chip chip-lg chip-success hide-sm"><Ic name="check-circle" />Lulus</span> : ready ? <span className="chip chip-lg chip-info hide-sm"><Ic name="exam" />Terbuka</span> : <span className="chip chip-lg chip-warning hide-sm"><Ic name="lock" />Belum terbuka</span>}
          </header>
        )}
      >
        <div className="quiz-result">
          <div className="stack gap-6 w-full result-stage">
            <section className="stack items-center gap-4 t-center" aria-labelledby="exam-intro-title">
              <div className="appi-stage"><AppiMascot mood={intro.mood} size="xl" enter="pop" label={`APPI ${intro.mood === "proud" ? "bangga" : intro.mood === "curious" ? "penasaran" : "menyemangati"}`} /></div>
              <div className="stack items-center gap-2">
                <span className="t-overline t-muted">Ujian akhir · Sertifikasi Expert</span>
                <h1 className="t-title" id="exam-intro-title">{intro.title}</h1>
                <p className="t-reading t-muted t-pretty">{intro.text}</p>
              </div>
            </section>

            <section className="card anim-rise" style={{ "--i": 1 }} aria-labelledby="req-title">
              <div className="card-pad stack gap-4">
                <div className="card-head">
                  <div className="stack gap-0-5">
                    <h2 className="card-title" id="req-title">Syarat ujian</h2>
                    <p className="card-desc">{verified} dari {required} modul terverifikasi</p>
                  </div>
                  <span className="t-caption t-strong t-num">{percent}%</span>
                </div>
                <Bar value={percent} animate label="Modul terverifikasi" now={verified} max={required} />
                <RequirementEggs modules={sortedModules} completedSet={completedSet} currentNumber={next?.moduleNumber} missing={eligibility?.missingModuleNumbers ?? []} />
              </div>
              <div className="card-sect card-pad">
                <ul className="cols-2" aria-label="Ketentuan ujian">
                  <li className="row gap-3"><span className="tile tile-sm" data-hue="gold"><Ic name="exam" /></span><span className="t-body t-medium">Soal pilihan ganda</span></li>
                  <li className="row gap-3"><span className="tile tile-sm" data-hue="gold"><Ic name="target" /></span><span className="t-body t-medium">Nilai lulus {passGrade}%</span></li>
                  <li className="row gap-3"><span className="tile tile-sm" data-hue="gold"><Ic name="eye" /></span><span className="t-body t-medium">Tanpa umpan balik per soal</span></li>
                  <li className="row gap-3"><span className="tile tile-sm" data-hue="gold"><Ic name="refresh" /></span><span className="t-body t-medium">Bisa diulang tanpa batas harian</span></li>
                </ul>
              </div>
              {!ready && !finished ? (
                <div className="card-foot">
                  <Ic name="lock" size="sm" className="t-muted" />
                  <span className="t-caption t-muted">Tombol mulai ujian muncul setelah {required} modul terverifikasi.</span>
                </div>
              ) : null}
            </section>

            <div className="row wrap justify-center gap-3">
              {finished ? (
                <Link className="btn btn-learn btn-lg btn-block-sm" to="/certification"><Ic name="cert" />Status sertifikat</Link>
              ) : ready ? (
                <button type="button" className="btn btn-learn btn-lg btn-block-sm" disabled={busy} aria-busy={busy || undefined} onClick={begin}>{resume ? "Lanjutkan ujian" : "Mulai ujian"}<Ic name="arrow-right" /></button>
              ) : (
                <Link className="btn btn-learn btn-lg btn-block-sm" to="/modules"><Ic name="route" />Pilih materi belajar</Link>
              )}
              <Link className="btn btn-ghost btn-lg btn-block-sm" to="/"><Ic name="arrow-left" />Kembali ke beranda</Link>
            </div>
          </div>
        </div>
      </FocusShell>
    );
  }

  const navigator = (
    <>
      <QuestionNavigator total={questions.length} current={current} answers={answers} flagged={flagged} onSelect={(index) => { setCurrent(index); setListOpen(false); }} />
      <div className="stack gap-3" style={{ padding: "12px 8px 0", borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => { setListOpen(false); setConfirmOpen(true); }}>Kirim ujian</button>
        <p className="row-start gap-2 t-caption t-muted"><Ic name="info" size="xs" style={{ marginTop: 2 }} />Jawaban tersimpan otomatis. Ujian bisa dikirim dari soal mana pun setelah semua soal terjawab.</p>
      </div>
    </>
  );
  const unanswered = questions.length - answeredCount;

  return (
    <FocusShell
      resetKey={current}
      label="Ujian akhir"
      outline={navigator}
      outlineLabel="Daftar soal ujian"
      outlineOpen={outlineOpen}
      bar={(
        <AssessmentBar
          title="Layer Poultry Farm Expert"
          context="Ujian akhir · Tingkat 6"
          onExit={exit}
          total={questions.length}
          current={current}
          checked={answeredCount}
          states={questions.map((_, index) => (answers[index] !== undefined ? "done" : undefined))}
          label="Progres ujian akhir"
        >
          <button type="button" className="btn btn-ghost btn-icon btn-quiet hide-md" aria-label={outlineOpen ? "Sembunyikan daftar soal" : "Tampilkan daftar soal"} aria-pressed={outlineOpen} onClick={() => setOutlineOpen((value) => !value)}><Ic name="sidebar" /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-quiet show-md" aria-label={`Daftar soal, ${answeredCount} dari ${questions.length} terjawab`} onClick={() => setListOpen(true)}><Ic name="list" /></button>
        </AssessmentBar>
      )}
      footer={(
        <>
          <div className="row gap-2">
            <button type="button" className="btn btn-ghost" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} aria-label="Soal sebelumnya">
              <Ic name="arrow-left" /><span className="hide-sm">Sebelumnya</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={Boolean(flagged[current])}
              aria-label={flagged[current] ? "Batal tandai soal" : "Tandai soal untuk ditinjau"}
              onClick={() => setFlagged((value) => ({ ...value, [current]: !value[current] }))}
            >
              <Ic name="flag" className={flagged[current] ? "t-warning" : undefined} /><span className="hide-sm">{flagged[current] ? "Batal tandai" : "Tandai"}</span>
            </button>
          </div>
          <span className="grow t-center t-caption t-muted"><span className="hide-sm">{answeredCount}/{questions.length} terjawab · nilai lulus {passGrade}%</span></span>
          {isLast ? (
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} aria-busy={busy || undefined} onClick={() => setConfirmOpen(true)}>Kirim ujian</button>
          ) : (
            <button type="button" className="btn btn-learn btn-lg" onClick={() => setCurrent((value) => value + 1)}>Berikutnya<Ic name="arrow-right" /></button>
          )}
        </>
      )}
    >
      <div className="lesson-stage">
        <section className="reading-col" aria-label={`Soal ${current + 1}`}>
          <QuizQuestion question={question} number={current + 1} total={questions.length} answer={answers[current]} onAnswer={select} />
        </section>
      </div>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="bottom">
          <SheetTitle className="sr-only">Daftar soal ujian</SheetTitle>
          <SheetDescription className="sr-only">Pilih soal untuk menjawab, meninjau, atau mengirim ujian.</SheetDescription>
          <div className="sheet-body" style={{ gap: "var(--s-3)", paddingTop: "var(--s-6)" }}>{navigator}</div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="md" mobile="center" hideClose>
          <div className="row gap-3">
            <span className="tile tile-lg"><Ic name="exam" /></span>
            <DialogTitle>{unanswered ? `${unanswered} soal belum dijawab` : "Kirim ujian akhir?"}</DialogTitle>
          </div>
          <DialogDescription>
            {unanswered
              ? "Semua soal harus dijawab sebelum ujian dapat dikirim. Gunakan daftar soal untuk menemukan yang masih kosong."
              : flaggedIndexes.length ? `${flaggedIndexes.length} soal masih ditandai untuk ditinjau. Jawaban tidak dapat diubah setelah dikirim.` : "Jawaban tidak dapat diubah setelah dikirim."}
          </DialogDescription>
          <div className="inset row wrap gap-3" style={{ padding: "var(--s-3) var(--s-4)" }}>
            <span className="row gap-2 t-support t-medium"><Ic name={unanswered ? "alert" : "check-circle"} size="sm" className={unanswered ? "t-warning" : "t-success"} />{answeredCount}/{questions.length} terjawab</span>
            {flaggedIndexes.length ? (
              <>
                <span className="vr" />
                <span className="row gap-2 t-support t-medium"><Ic name="flag" size="sm" className="t-warning" />Soal {flaggedIndexes.map((index) => index + 1).join(", ")} ditandai</span>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Tinjau lagi</button>
            {unanswered ? (
              <button type="button" className="btn btn-primary" onClick={() => { setConfirmOpen(false); setCurrent(questions.findIndex((_, index) => answers[index] === undefined)); }}>Ke soal kosong</button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Kirim sekarang</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FocusShell>
  );
}
