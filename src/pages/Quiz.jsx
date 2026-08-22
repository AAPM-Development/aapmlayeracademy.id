import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, RotateCcw, ArrowRight, AlertCircle } from 'lucide-react';
import { useQuizQuestions, useSaveProgress, useUserProgress } from '@/lib/useCourseData';
import { useToast } from '@/components/ui/use-toast';

export default function Quiz() {
  const { moduleNumber } = useParams();
  const num = parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: questions = [], isLoading } = useQuizQuestions(num);
  const saveProgress = useSaveProgress();
  const { data: progress = [] } = useUserProgress();
  const prog = progress.find(p => p.moduleNumber === num);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const q = questions[current];

  const score = useMemo(() => {
    if (!submitted) return 0;
    return questions.filter((qq, i) => answers[i] === qq.correctIndex).length;
  }, [submitted, answers, questions]);

  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passed = pct >= 70;

  const submit = async () => {
    setSubmitted(true);
    await saveProgress.mutateAsync({
      moduleNumber: num,
      data: {
        moduleNumber: num,
        completed: true,
        quizScore: questions.filter((qq, i) => answers[i] === qq.correctIndex).length,
        quizTotal: questions.length,
      },
    });
    if (pct >= 70) {
      toast({ title: 'Kuis Lulus!', description: `Skor ${pct}% — Kerja bagus.` });
    }
  };

  if (isLoading) {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-sm text-muted-foreground">Memuat kuis…</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <h2 className="font-semibold mb-1">Kuis Belum Tersedia</h2>
        <p className="text-sm text-muted-foreground mb-4">Soal kuis untuk modul ini sedang disiapkan oleh admin.</p>
        <Link to={`/modules/${num}`} className="inline-flex items-center gap-1.5 text-sm text-amber-600">
          <ArrowLeft className="h-4 w-4" /> Kembali ke modul
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className={`inline-flex h-16 w-16 items-center justify-center rounded-full mb-4 ${passed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <Trophy className={`h-8 w-8 ${passed ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <h2 className="text-xl font-bold mb-1">{passed ? 'Selamat, Anda Lulus!' : 'Belum Lulus'}</h2>
          <p className="text-sm text-muted-foreground mb-5">Skor Anda {score}/{questions.length} ({pct}%) · Passing grade 70%</p>

          <div className="space-y-3 text-left mb-6 max-h-80 overflow-y-auto">
            {questions.map((qq, i) => {
              const correct = answers[i] === qq.correctIndex;
              return (
                <div key={i} className="rounded-xl border p-3 text-sm">
                  <div className="flex gap-2 mb-1.5">
                    {correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                    <span className="font-medium">{qq.question}</span>
                  </div>
                  {!correct && (
                    <div className="text-xs text-red-600 mb-1 pl-6">Jawaban Anda: {qq.options[answers[i]] || '—'}</div>
                  )}
                  <div className="text-xs text-emerald-600 pl-6 mb-1">Jawaban benar: {qq.options[qq.correctIndex]}</div>
                  {qq.explanation && <div className="text-xs text-muted-foreground pl-6">{qq.explanation}</div>}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSubmitted(false); setAnswers({}); setCurrent(0); }} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted">
              <RotateCcw className="h-4 w-4" /> Ulangi
            </button>
            <button onClick={() => navigate('/modules')} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-medium">
              Modul Berikutnya <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answered = answers[current] !== undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Link to={`/modules/${num}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke modul
      </Link>
      <h1 className="text-xl font-bold mb-1">Kuis Modul {num}</h1>
      <p className="text-sm text-muted-foreground mb-5">{questions.length} soal · Passing grade 70%</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{current + 1}/{questions.length}</span>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${difficultyColor(q.difficulty)}`}>{q.difficulty}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{q.type}</span>
        </div>
        <h3 className="font-medium mb-4">{q.question}</h3>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setAnswers({ ...answers, [current]: i })}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                answers[current] === i
                  ? 'border-amber-500 bg-amber-50 font-medium'
                  : 'border-border hover:border-amber-200 hover:bg-muted/40'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] mr-2.5 shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-5">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted"
        >
          Sebelumnya
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent(c => c + 1)}
            disabled={!answered}
            className="rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-amber-700"
          >
            Berikutnya
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={Object.keys(answers).length < questions.length}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" /> Submit
          </button>
        )}
      </div>
    </div>
  );
}

function difficultyColor(d) {
  switch (d) {
    case 'easy': return 'bg-emerald-100 text-emerald-700';
    case 'medium': return 'bg-sky-100 text-sky-700';
    case 'hard': return 'bg-amber-100 text-amber-700';
    case 'expert': return 'bg-red-100 text-red-700';
    default: return 'bg-muted text-muted-foreground';
  }
}