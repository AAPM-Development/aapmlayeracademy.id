import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, BookOpen, Award, TrendingUp, ArrowRight, Target, CheckCircle2, Egg } from 'lucide-react';
import { useModules, useUserProgress } from '@/lib/useCourseData';

const levels = [
  { num: 1, name: 'Foundation', cert: 'Layer Poultry Farm Foundation', color: 'from-amber-400 to-amber-500' },
  { num: 2, name: 'Brooding & Rearing', cert: 'Layer Farm Operator', color: 'from-orange-400 to-orange-500' },
  { num: 3, name: 'Layer Management', cert: 'Layer Farm Operator', color: 'from-rose-400 to-rose-500' },
  { num: 4, name: 'Nutrition', cert: 'Layer Farm Supervisor', color: 'from-lime-400 to-lime-500' },
  { num: 5, name: 'Water Management', cert: 'Layer Farm Supervisor', color: 'from-cyan-400 to-cyan-500' },
  { num: 6, name: 'Environment & Closed House', cert: 'Layer Farm Supervisor', color: 'from-sky-400 to-sky-500' },
  { num: 7, name: 'Health & Veterinary', cert: 'Layer Farm Manager', color: 'from-red-400 to-red-500' },
  { num: 8, name: 'Biosecurity', cert: 'Layer Farm Manager', color: 'from-emerald-400 to-emerald-500' },
  { num: 9, name: 'Egg Management', cert: 'Layer Farm Manager', color: 'from-violet-400 to-violet-500' },
  { num: 10, name: 'Farm Data & KPI', cert: 'Advanced Layer Farm Management', color: 'from-indigo-400 to-indigo-500' },
  { num: 11, name: 'Farm Economics', cert: 'Advanced Layer Farm Management', color: 'from-teal-400 to-teal-500' },
  { num: 12, name: 'Farm Management', cert: 'Advanced Layer Farm Management', color: 'from-fuchsia-400 to-fuchsia-500' },
  { num: 13, name: 'Advanced Management', cert: 'Layer Poultry Farm Expert', color: 'from-purple-400 to-purple-500' },
  { num: 14, name: 'Expert Level', cert: 'Layer Poultry Farm Expert', color: 'from-slate-600 to-slate-800' },
];

const paths = [
  { name: 'Beginner', desc: 'Foundation → Brooding → Growing → Layer → Nutrition → Health', modules: [1, 2, 3, 4, 5, 9, 14], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Intermediate', desc: 'Environment → Biosecurity → Egg Quality → KPI → Economics', modules: [12, 15, 16, 17, 18, 19], color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { name: 'Advanced', desc: 'Troubleshooting → Analytics → Optimization → Farm Manager', modules: [21, 22, 20], color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { name: 'Expert', desc: 'Farm Strategy → Data Analytics → Economics → Benchmarking → Continuous Improvement', modules: [22, 19, 20], color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function Home() {
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();

  const completedSet = new Set(progress.filter(p => p.completed).map(p => p.moduleNumber));
  const completed = completedSet.size;
  const totalModules = 22;
  const pct = Math.round((completed / totalModules) * 100);

  const avgScore = progress.filter(p => p.quizScore != null && p.quizTotal).length > 0
    ? Math.round(progress.filter(p => p.quizTotal).reduce((a, p) => a + (p.quizScore / p.quizTotal * 100), 0) / progress.filter(p => p.quizTotal).length)
    : 0;

  const nextModule = modules.find(m => !completedSet.has(m.moduleNumber));

  const currentLevel = nextModule ? levels.find(l => l.num === nextModule.level) : levels[levels.length - 1];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 sm:p-10 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 opacity-10">
          <Egg className="h-48 w-48" strokeWidth={1} />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> E-Course Profesional
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Layer Poultry Farm Management</h1>
          <p className="text-white/90 max-w-2xl text-sm sm:text-base leading-relaxed">
            Dari pemula hingga expert — pelajari seluruh siklus produksi ayam petelur komersial:
            DOC → Brooding → Growing → Pre-Lay → Peak → Post-Peak → Molting → Spent Hen, dengan
            kombinasi video, materi baca, simulasi interaktif, kuis, case study, dan sertifikasi.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/modules" className="inline-flex items-center gap-2 rounded-xl bg-white text-amber-700 px-5 py-2.5 text-sm font-semibold hover:bg-amber-50 transition-colors">
              <BookOpen className="h-4 w-4" /> Mulai Belajar
            </Link>
            <Link to="/ai-assistant" className="inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/25 transition-colors">
              <Sparkles className="h-4 w-4" /> AI Farm Assistant
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard icon={CheckCircle2} label="Modul Selesai" value={`${completed}/${totalModules}`} tint="text-emerald-600 bg-emerald-50" />
        <StatCard icon={TrendingUp} label="Progres Course" value={`${pct}%`} tint="text-amber-600 bg-amber-50" />
        <StatCard icon={Target} label="Rata-rata Nilai Kuis" value={`${avgScore}%`} tint="text-sky-600 bg-sky-50" />
        <StatCard icon={Award} label="Level Saat Ini" value={currentLevel?.name || 'Foundation'} tint="text-violet-600 bg-violet-50" />
      </div>

      {/* Next lesson */}
      {nextModule && (
        <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lanjutkan Belajar</div>
            <span className="text-xs text-muted-foreground">Modul {nextModule.moduleNumber} · Level {nextModule.level}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">{nextModule.title}</h3>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{nextModule.summary}</p>
          <Link to={`/modules/${nextModule.moduleNumber}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700">
            Buka Lesson <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Learning paths */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Jalur Pembelajaran</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {paths.map(p => (
            <div key={p.name} className={`rounded-2xl border p-5 ${p.color}`}>
              <div className="font-semibold mb-1">{p.name}</div>
              <p className="text-xs leading-relaxed opacity-90">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Levels overview */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">14 Level Sertifikasi</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {levels.map(l => {
            const levelModules = modules.filter(m => m.level === l.num);
            const levelDone = levelModules.filter(m => completedSet.has(m.moduleNumber)).length;
            const done = levelModules.length > 0 && levelDone === levelModules.length;
            return (
              <Link
                key={l.num}
                to="/modules"
                className="group rounded-xl border bg-card p-3 hover:shadow-md transition-shadow"
              >
                <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${l.color} mb-2.5`} />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Level {l.num}</span>
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
                <div className="text-xs font-semibold mt-0.5 leading-tight">{l.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{l.cert}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tint} mb-2.5`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}