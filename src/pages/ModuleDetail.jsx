import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, PlayCircle, Target, CheckSquare, ClipboardList,
  Lightbulb, CheckCircle2, ArrowRight, FileText
} from 'lucide-react';
import { useModules, useUserProgress, useSaveProgress } from '@/lib/useCourseData';
import { useToast } from '@/components/ui/use-toast';

export default function ModuleDetail() {
  const { moduleNumber } = useParams();
  const num = parseInt(moduleNumber, 10);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: modules = [], isLoading } = useModules();
  const { data: progress = [] } = useUserProgress();
  const saveProgress = useSaveProgress();

  const mod = modules.find(m => m.moduleNumber === num);
  const prog = progress.find(p => p.moduleNumber === num);
  const [tab, setTab] = useState('content');

  const markComplete = async () => {
    await saveProgress.mutateAsync({ moduleNumber: num, data: { moduleNumber: num, completed: true } });
    toast({ title: 'Modul diselesaikan', description: 'Lanjut ke kuis untuk menguji pemahaman.' });
  };

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-muted-foreground">Memuat modul…</div>;
  }
  if (!mod) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Modul belum tersedia. Konten sedang disiapkan oleh admin.</p>
        <Link to="/modules" className="inline-flex items-center gap-1.5 mt-4 text-sm text-amber-600">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar modul
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'content', label: 'Materi', icon: FileText },
    { id: 'video', label: 'Video Lesson', icon: PlayCircle },
    { id: 'objectives', label: 'Tujuan & Insight', icon: Target },
    { id: 'practical', label: 'Praktik', icon: ClipboardList },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <Link to="/modules" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Semua Modul
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">Level {mod.level}</span>
        <span className="text-xs text-muted-foreground">Modul {mod.moduleNumber} · {mod.category}</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">{mod.title}</h1>
      <p className="text-sm text-muted-foreground mb-5">{mod.summary}</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-amber-500 text-amber-700 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'content' && (
        <div className="markdown-body">
          <ReactMarkdown>{mod.content || 'Konten modul sedang disiapkan.'}</ReactMarkdown>
        </div>
      )}

      {tab === 'video' && (
        <div className="space-y-4">
          <div className="aspect-video rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white">
            <div className="text-center">
              <PlayCircle className="h-14 w-14 mx-auto mb-2 opacity-80" />
              <div className="text-sm font-medium">Video Lesson</div>
              <div className="text-xs text-white/60 mt-1">Durasi 5–15 menit</div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Script Instruktur</h3>
            <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-line">
              {mod.videoScript || 'Script video sedang disiapkan.'}
            </div>
          </div>
        </div>
      )}

      {tab === 'objectives' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><Target className="h-4 w-4 text-amber-600" /> Tujuan Pembelajaran</div>
            <ul className="space-y-1.5">
              {(mod.learningObjectives || []).map((o, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{o}</span>
                </li>
              ))}
              {(!mod.learningObjectives || mod.learningObjectives.length === 0) && <li className="text-sm text-muted-foreground">Daftar tujuan pembelajaran akan ditampilkan di sini.</li>}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" /> Key Takeaways</div>
            <ul className="space-y-1.5">
              {(mod.keyTakeaways || []).map((k, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </div>
          {mod.checklist && mod.checklist.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><CheckSquare className="h-4 w-4 text-emerald-600" /> Checklist</div>
              <ul className="space-y-1.5">
                {mod.checklist.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <input type="checkbox" className="mt-1 h-3.5 w-3.5 rounded" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'practical' && (
        <div className="rounded-xl border bg-muted/40 p-5">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-amber-600" /> Practical Assignment</div>
          <p className="text-sm leading-relaxed whitespace-pre-line">{mod.practicalAssignment || 'Tugas praktik untuk modul ini akan ditampilkan di sini.'}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 pt-5 border-t">
        <button
          onClick={markComplete}
          disabled={prog?.completed || saveProgress.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          {prog?.completed ? 'Modul Selesai' : 'Tandai Selesai'}
        </button>
        <button
          onClick={() => navigate(`/quiz/${num}`)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-amber-700 transition-colors"
        >
          Kerjakan Kuis <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}