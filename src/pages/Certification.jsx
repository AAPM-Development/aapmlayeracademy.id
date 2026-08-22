import React from 'react';
import { Award, CheckCircle2, Lock, Star, Download, ChevronRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserProgress, useCertificates, useIssueCertificate } from '@/lib/useCourseData';
import { useToast } from '@/components/ui/use-toast';

const certLevels = [
  { level: 1, name: 'Layer Poultry Farm Foundation', modules: [1, 2, 3], color: 'from-amber-400 to-amber-500' },
  { level: 2, name: 'Layer Farm Operator', modules: [4, 5], color: 'from-orange-400 to-orange-500' },
  { level: 3, name: 'Layer Farm Supervisor', modules: [6, 7, 8, 11, 12, 13, 15, 16, 17], color: 'from-rose-400 to-rose-500' },
  { level: 4, name: 'Layer Farm Manager', modules: [9, 10, 14, 18], color: 'from-violet-400 to-violet-500' },
  { level: 5, name: 'Advanced Layer Farm Management', modules: [19, 20, 21], color: 'from-indigo-400 to-indigo-500' },
  { level: 6, name: 'Layer Poultry Farm Expert', modules: [22], requiresFinal: true, color: 'from-slate-600 to-slate-800' },
];

export default function Certification() {
  const { data: progress = [] } = useUserProgress();
  const { data: certs = [] } = useCertificates();
  const issue = useIssueCertificate();
  const { toast } = useToast();

  const completedSet = new Set(progress.filter(p => p.completed).map(p => p.moduleNumber));
  const finalPassed = progress.some(p => p.moduleNumber === 0 && p.completed);

  const eligible = (c) => c.modules.every(m => completedSet.has(m)) && (!c.requiresFinal || finalPassed);

  const claim = async (c) => {
    if (!eligible(c)) return;
    await issue.mutateAsync({ levelNumber: c.level, levelName: c.name, score: 100, examType: 'level', holderName: 'Peserta Layer Farm Academy' });
    toast({ title: 'Sertifikat diterbitkan!', description: c.name });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6 text-amber-600" /> Sertifikasi</h1>
        <p className="text-sm text-muted-foreground mt-1">Selesaikan modul & ujian untuk membuka sertifikat setiap level.</p>
      </div>

      <Link to="/final-exam" className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 text-white hover:opacity-95 transition-opacity">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><GraduationCap className="h-6 w-6" /></div>
          <div>
            <div className="text-xs text-amber-300 font-medium">FINAL EXAMINATION</div>
            <div className="font-semibold">Ujian Akhir — Layer Poultry Farm Expert</div>
            <div className="text-xs text-white/60 mt-0.5">50 soal · Passing grade 80% · Sertifikat Expert</div>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/70" />
      </Link>

      <div className="grid sm:grid-cols-2 gap-4">
        {certLevels.map(c => {
          const owned = certs.find(x => x.levelNumber === c.level);
          const done = c.modules.filter(m => completedSet.has(m)).length;
          const canClaim = eligible(c) && !owned;
          const locked = !eligible(c);
          return (
            <div key={c.level} className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className={`h-2 bg-gradient-to-r ${c.color}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Level {c.level}</div>
                    <h3 className="font-semibold leading-tight">{c.name}</h3>
                  </div>
                  {owned ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Star className="h-5 w-5 fill-emerald-500" /></div>
                  ) : locked ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><Lock className="h-4 w-4" /></div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Award className="h-4 w-4" /></div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {c.requiresFinal ? 'Lulus seluruh modul + Final Exam' : `Selesaikan ${c.modules.length} modul`}
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${(done / c.modules.length) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{done}/{c.modules.length} modul{c.requiresFinal ? ` · Final ${finalPassed ? '✓' : '✗'}` : ''}</span>
                  {owned ? (
                    <button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Download className="h-3.5 w-3.5" /> Unduh</button>
                  ) : canClaim ? (
                    <button onClick={() => claim(c)} className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-amber-700">Klaim</button>
                  ) : (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Terkunci</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Owned certificates */}
      {certs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Sertifikat Saya</h2>
          <div className="space-y-3">
            {certs.map(cert => (
              <div key={cert.id} className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white"><Award className="h-6 w-6" /></div>
                  <div>
                    <div className="text-xs text-amber-700 font-medium">LEVEL {cert.levelNumber} CERTIFICATE</div>
                    <div className="font-semibold">{cert.levelName}</div>
                    <div className="text-xs text-muted-foreground">{cert.holderName}</div>
                  </div>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700">
                  <Download className="h-4 w-4" /> Unduh PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}