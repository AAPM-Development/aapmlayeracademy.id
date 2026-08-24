import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Trophy, RotateCcw, Award, GraduationCap, AlertCircle } from 'lucide-react';
import { useQuizQuestions, useSaveProgress, useIssueCertificate } from '@/lib/useCourseData';
import { useToast } from '@/components/ui/use-toast';

export default function FinalExam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: questions = [], isLoading } = useQuizQuestions(0);
  const saveProgress = useSaveProgress();
  const issue = useIssueCertificate();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const q = questions[current];
  const score = useMemo(() => submitted ? questions.filter((qq, i) => answers[i] === qq.correctIndex).length : 0, [submitted, answers, questions]);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = pct >= 80;

  const submit = async () => {
    setSubmitted(true);
    const correct = questions.filter((qq, i) => answers[i] === qq.correctIndex).length;
    await saveProgress.mutateAsync({ moduleNumber: 0, data: { moduleNumber: 0, completed: pct >= 80, quizScore: correct, quizTotal: questions.length } });
    if (pct >= 80) {
      await issue.mutateAsync({ levelNumber: 6, levelName: 'Layer Poultry Farm Expert', score: pct, examType: 'final', holderName: 'Peserta Layer Farm Academy' });
      toast({ title: 'Final Exam Lulus!', description: `Sertifikat Expert telah diterbitkan.` });
    } else {
      toast({ title: 'Belum Lulus', description: 'Pelajari modul yang ditandai lalu coba lagi.', variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-sm text-muted-foreground">Memuat final exam…</div>;

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <h2 className="font-semibold mb-1">Final Exam Belum Tersedia</h2>
        <p className="text-sm text-muted-foreground mb-4">Soal final exam (min. 50 soal) sedang disiapkan oleh admin.</p>
        <Link to="/modules" className="inline-flex items-center gap-1.5 text-sm text-amber-600"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className={`inline-flex h-16 w-16 items-center justify-center rounded-full mb-4 ${passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {passed ? <Trophy className="h-8 w-8 text-emerald-600" /> : <GraduationCap className="h-8 w-8 text-red-500" />}
          </div>
          <h2 className="text-xl font-bold mb-1">{passed ? 'Selamat! Anda Lulus Final Exam' : 'Belum Lulus'}</h2>
          <p className="text-sm text-muted-foreground mb-5">Skor {score}/{questions.length} ({pct}%) · Passing grade 80%</p>
          {passed && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-4 mb-5">
              <div className="flex items-center gap-2 justify-center text-amber-700 font-semibold"><Award className="h-5 w-5" /> Sertifikat Layer Poultry Farm Expert diterbitkan</div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSubmitted(false); setAnswers({}); setCurrent(0); }} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted">
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <Link to="/certification" className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-medium">
              <Award className="h-4 w-4" /> Lihat Sertifikat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const answered = answers[current] !== undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 text-white mb-5">
        <div className="flex items-center gap-2 text-amber-300 text-xs font-medium mb-1"><GraduationCap className="h-4 w-4" /> FINAL EXAMINATION</div>
        <h1 className="text-lg font-bold">Ujian Akhir — Layer Poultry Farm Expert</h1>
        <p className="text-sm text-white/70 mt-0.5">{questions.length} soal · Passing grade ≥80% · 20% Basic · 30% Mgmt · 20% Nutrition/Health · 15% Env/Biosec · 15% Economics</p>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-slate-700 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{current + 1}/{questions.length}</span>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${q.difficulty === 'expert' ? 'bg-red-100 text-red-700' : q.difficulty === 'hard' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{q.difficulty}</span>
        </div>
        <h3 className="font-medium mb-4">{q.question}</h3>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setAnswers({ ...answers, [current]: i })}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${answers[current] === i ? 'border-slate-700 bg-slate-50 font-medium' : 'border-border hover:border-slate-300'}`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] mr-2.5">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-5">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted">Sebelumnya</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(c => c + 1)} disabled={!answered} className="rounded-xl bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-900">Berikutnya</button>
        ) : (
          <button onClick={submit} disabled={Object.keys(answers).length < questions.length} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Submit Exam</button>
        )}
      </div>
    </div>
  );
}
