import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, Layers, BookOpen } from 'lucide-react';
import { useModules, useUserProgress } from '@/lib/useCourseData';

const levelNames = {
  1: 'Foundation', 2: 'Brooding & Rearing', 3: 'Layer Management',
  4: 'Nutrition', 5: 'Water Management', 6: 'Environment & Closed House',
  7: 'Health & Veterinary', 8: 'Biosecurity', 9: 'Egg Management',
  10: 'Farm Data & KPI', 11: 'Farm Economics', 12: 'Farm Management',
  13: 'Advanced Management', 14: 'Expert Level',
};

export default function Modules() {
  const { data: modules = [], isLoading } = useModules();
  const { data: progress = [] } = useUserProgress();
  const completedSet = new Set(progress.filter(p => p.completed).map(p => p.moduleNumber));

  const byLevel = {};
  modules.forEach(m => {
    if (!byLevel[m.level]) byLevel[m.level] = [];
    byLevel[m.level].push(m);
  });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Modul & Lesson</h1>
        <p className="text-sm text-muted-foreground mt-1">22 modul terstruktur dalam 14 level — dari Foundation hingga Expert.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {levels.map(lvl => (
            <div key={lvl}>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold">Level {lvl} — {levelNames[lvl] || ''}</h2>
                <span className="text-xs text-muted-foreground">· {byLevel[lvl].length} modul</span>
              </div>
              <div className="space-y-2.5">
                {byLevel[lvl].sort((a, b) => a.moduleNumber - b.moduleNumber).map(m => {
                  const done = completedSet.has(m.moduleNumber);
                  return (
                    <Link
                      key={m.id}
                      to={`/modules/${m.moduleNumber}`}
                      className="group flex items-center gap-4 rounded-xl border bg-card p-4 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {done ? <CheckCircle2 className="h-5 w-5" /> : m.moduleNumber}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{m.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{m.summary}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {m.videoScript && <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> Video Lesson</span>}
                          <span>{m.category}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {modules.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Circle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Modul sedang dimuat. Hubungi admin untuk menambahkan konten modul.
            </div>
          )}
        </div>
      )}
    </div>
  );
}