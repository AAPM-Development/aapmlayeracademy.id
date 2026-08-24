import React from "react";
import { ArrowRight, BookOpen, Calculator, CheckCircle2, ChevronRight, Clock3, Gauge, PlayCircle, Sparkles, Target, Trophy, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLevelProgress, learningLevels, TOTAL_MODULES } from "@/lib/academyData";

export function ContinueLearning({ module = null, progress = null } = {}) {
  if (!module) {
    return (
      <Card className="relative overflow-hidden border-brand-green/20 bg-brand-green/5 shadow-[var(--card-shadow)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-green to-[#9bdd73]" />
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-green">Learning path selesai</div>
            <h2 className="text-xl font-semibold tracking-tight">Semua modul sudah selesai.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tinjau kembali roadmap atau lanjutkan ke Final Exam.</p>
          </div>
          <Button asChild className="shrink-0 bg-brand-green text-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-green/90"><Link to="/final-exam">Buka Final Exam <ArrowRight /></Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-border/80 bg-card shadow-[var(--card-shadow)] transition-shadow duration-300 hover:shadow-[0_26px_52px_-34px_rgba(26,58,37,0.65)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-orange via-[#ff8b1c] to-brand-green" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Lanjutkan belajar</div>
              <span className="text-xs text-muted-foreground">Modul {module.moduleNumber} · Level {module.level}</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{module.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{module.summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild className="bg-brand-orange text-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-orange/90"><Link to={`/modules/${module.moduleNumber}`}>{progress?.completed ? "Review lesson" : "Buka lesson"} <ArrowRight /></Link></Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Fokus berikutnya di roadmap</span>
            </div>
          </div>
          <div className="relative hidden h-24 w-24 shrink-0 items-center justify-center rounded-full border border-brand-orange/20 bg-brand-orange/5 text-brand-orange sm:flex">
            <div className="absolute inset-2 rounded-full border border-brand-orange/15" />
            <PlayCircle className="relative h-9 w-9 transition-transform duration-300 group-hover:scale-110" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMetricStrip({ modules = [], progress = [], nextModule = null } = {}) {
  const completed = progress.filter((item) => item?.completed).length;
  const total = modules.length || TOTAL_MODULES;
  const coursePercent = total ? Math.round((completed / total) * 100) : 0;
  const scored = progress.filter((item) => item?.quizTotal);
  const average = scored.length ? Math.round(scored.reduce((totalScore, item) => totalScore + ((item.quizScore || 0) / item.quizTotal) * 100, 0) / scored.length) : 0;
  const activeLevel = nextModule
    ? learningLevels.find((level) => level.number === nextModule.level)
    : modules.length
      ? learningLevels[learningLevels.length - 1]
      : learningLevels[0];
  const metrics = [
    { value: `${completed}/${total}`, label: "Modul selesai", detail: "Learning path", icon: CheckCircle2, tone: "green" },
    { value: `${coursePercent}%`, label: "Progress course", detail: "Ritme belajar", icon: TrendingUp, tone: "orange" },
    { value: `${average}%`, label: "Rata-rata nilai kuis", detail: `${scored.length} kuis tersimpan`, icon: Target, tone: "blue" },
    { value: activeLevel?.name || "Foundation", label: "Level saat ini", detail: "Professional track", icon: Trophy, tone: "violet" },
  ];
  const tones = {
    green: { tile: "bg-[#e7faf0] text-[#079661]", accent: "bg-[#bcefd2]" },
    orange: { tile: "bg-[#fff4df] text-[#d87800]", accent: "bg-[#ffd991]" },
    blue: { tile: "bg-[#e8f6ff] text-[#008ed1]", accent: "bg-[#b6e5fb]" },
    violet: { tile: "bg-[#f1edff] text-[#7040df]", accent: "bg-[#d8caff]" },
  };

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const tone = tones[metric.tone];
        return (
          <div key={metric.label} className="academy-enter group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-[var(--card-shadow)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-32px_rgba(26,58,37,0.7)]" style={{ animationDelay: `${index * 70}ms` }}>
            <div className={cn("absolute -right-7 -top-7 h-20 w-20 rounded-full opacity-60 transition-transform duration-300 group-hover:scale-125", tone.accent)} />
            <div className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl", tone.tile)}><Icon className="h-[18px] w-[18px]" /></div>
            <div className="relative mt-4 truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">{metric.value}</div>
            <div className="relative mt-1 text-xs font-medium text-foreground/80">{metric.label}</div>
            <div className="relative mt-0.5 text-[11px] text-muted-foreground">{metric.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

const dashboardTracks = [
  { name: "Beginner", description: "Bangun fondasi flock dan ritme kerja yang konsisten.", levels: [1, 2, 3, 4, 5], tone: "green", icon: "01" },
  { name: "Intermediate", description: "Hubungkan lingkungan, biosecurity, telur, dan KPI.", levels: [6, 7, 8, 9, 10, 11], tone: "blue", icon: "02" },
  { name: "Advanced", description: "Kelola operasi dengan root cause analysis dan disiplin data.", levels: [12, 13], tone: "violet", icon: "03" },
  { name: "Expert", description: "Ambil keputusan lintas fungsi dan pimpin perbaikan farm.", levels: [14], tone: "slate", icon: "04" },
];

export function LearningTracks({ modules = [], progress = [] } = {}) {
  const completedSet = new Set(progress.filter((item) => item?.completed).map((item) => item.moduleNumber));
  const tones = {
    green: { card: "border-[#a7e9c1] from-[#ecfff4] via-white to-[#d9f8e6]", icon: "bg-[#d7f7e4] text-[#078c5b]", bar: "bg-[#12a66d]", label: "text-[#078c5b]" },
    blue: { card: "border-[#b9e2fa] from-[#eff9ff] via-white to-[#dff2ff]", icon: "bg-[#dff2ff] text-[#0086c9]", bar: "bg-[#129bd8]", label: "text-[#0086c9]" },
    violet: { card: "border-[#d6c9ff] from-[#f6f3ff] via-white to-[#ece5ff]", icon: "bg-[#e9e2ff] text-[#7040df]", bar: "bg-[#8054e7]", label: "text-[#7040df]" },
    slate: { card: "border-[#d9e1eb] from-[#f8fafc] via-white to-[#edf1f7]", icon: "bg-[#e8edf5] text-[#304563]", bar: "bg-[#49637f]", label: "text-[#304563]" },
  };

  return (
    <section className="academy-enter mt-8" style={{ animationDelay: "180ms" }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Learning path</div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Jalur pembelajaran</h2>
        </div>
        <Link to="/modules" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Lihat semua <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {dashboardTracks.map((track) => {
          const tone = tones[track.tone];
          const stats = track.levels.reduce((result, levelNumber) => {
            const levelStats = getLevelProgress(levelNumber, modules, completedSet);
            return { completed: result.completed + levelStats.completed, total: result.total + levelStats.total };
          }, { completed: 0, total: 0 });
          const percent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
          const levelNames = track.levels.map((levelNumber) => learningLevels.find((level) => level.number === levelNumber)?.name).filter(Boolean);

          return (
            <Link key={track.name} to="/modules" className={cn("group relative overflow-hidden rounded-[1.25rem] border bg-gradient-to-br p-5 shadow-[0_14px_30px_-28px_rgba(26,58,37,0.8)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_26px_46px_-30px_rgba(26,58,37,0.55)]", tone.card)}>
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[14px] border-white/70 opacity-70 transition-transform duration-500 group-hover:scale-125" />
              <div className="relative flex items-start gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold", tone.icon)}>{track.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3"><h3 className={cn("text-base font-semibold", tone.label)}>{track.name}</h3><ArrowRight className={cn("h-4 w-4 transition-transform duration-300 group-hover:translate-x-1", tone.label)} /></div>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{track.description}</p>
                </div>
              </div>
              <div className="relative mt-5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>{stats.completed}/{stats.total || "—"} modul selesai</span><span>{track.levels.length} learning level</span></div>
              <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-black/5"><div className={cn("h-full rounded-full transition-[width] duration-500", tone.bar)} style={{ width: `${percent}%` }} /></div>
              <div className="relative mt-3 truncate text-[11px] text-muted-foreground/80">{levelNames.slice(0, 4).join(" · ")}{levelNames.length > 4 ? " · …" : ""}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function LearningProgressSummary({ modules = [], progress = [] } = {}) {
  const completed = progress.filter((item) => item?.completed).length;
  const percent = modules.length ? Math.round((completed / modules.length) * 100) : Math.round((completed / TOTAL_MODULES) * 100);
  const scored = progress.filter((item) => item?.quizTotal);
  const average = scored.length ? Math.round(scored.reduce((total, item) => total + ((item.quizScore || 0) / item.quizTotal) * 100, 0) / scored.length) : 0;

  return (
    <Card className="shadow-none">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Learning progress</CardTitle>
            <CardDescription className="mt-1">Ritme belajar Anda di Academy.</CardDescription>
          </div>
          <Gauge className="h-5 w-5 text-brand-green" />
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
        <div className="flex items-end justify-between gap-3">
          <div className="text-3xl font-semibold tracking-tight">{percent}%</div>
          <div className="text-right text-xs text-muted-foreground">{completed}/{modules.length || TOTAL_MODULES} modul selesai</div>
        </div>
        <Progress value={percent} className="mt-3 h-2 bg-muted [&>div]:bg-brand-green" />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div><div className="text-lg font-semibold">{average}%</div><div className="text-xs text-muted-foreground">Rata-rata kuis</div></div>
          <div><div className="text-lg font-semibold">{scored.length}</div><div className="text-xs text-muted-foreground">Kuis tersimpan</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LearningJourney({ modules = [], progress = [] } = {}) {
  const completedSet = new Set(progress.filter((item) => item?.completed).map((item) => item.moduleNumber));

  return (
    <Card className="shadow-none">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Learning journey</CardTitle>
            <CardDescription className="mt-1">14 level yang membentuk jalur kompetensi Anda.</CardDescription>
          </div>
          <Link to="/modules" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Lihat path <ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {learningLevels.slice(0, 6).map((level) => {
            const stats = getLevelProgress(level.number, modules, completedSet);
            const active = stats.completed > 0 && stats.completed < stats.total;
            const done = stats.total > 0 && stats.completed === stats.total;
            return (
              <Link key={level.number} to="/modules" className="group rounded-xl border border-border p-3 transition-colors hover:border-brand-green/40 hover:bg-brand-green/5">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", done ? "bg-success/15 text-success" : active ? "bg-brand-orange/15 text-brand-orange" : "bg-muted text-muted-foreground")}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : level.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-medium">{level.name}</div><span className="text-[11px] text-muted-foreground">{stats.completed}/{stats.total || "—"}</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", done ? "bg-success" : "bg-brand-orange")} style={{ width: `${stats.percent}%` }} /></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-brand-orange" /> Progress detail tersedia di Learning Path.</div>
      </CardContent>
    </Card>
  );
}

export function QuickToolGrid() {
  const tools = [
    { to: "/calculators", label: "Farm Calculators", description: "Hitung indikator operasional.", icon: Calculator, tone: "text-brand-orange bg-brand-orange/10" },
    { to: "/kpi", label: "Farm KPI", description: "Review data produksi.", icon: Target, tone: "text-info bg-info/10" },
    { to: "/ai-assistant", label: "AI Farm Assistant", description: "Tanya dengan konteks farm.", icon: Sparkles, tone: "text-ai bg-ai/10" },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3"><CardTitle className="text-base">Quick tools</CardTitle><CardDescription className="mt-1">Alat bantu saat Anda belajar.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 p-5 pt-2 sm:p-6 sm:pt-2">
        {tools.map((tool) => { const Icon = tool.icon; return <Link key={tool.to} to={tool.to} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-brand-green/30 hover:bg-muted/40"><div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tool.tone)}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{tool.label}</div><div className="truncate text-xs text-muted-foreground">{tool.description}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>; })}
      </CardContent>
    </Card>
  );
}

export function DashboardWelcome({ user = null } = {}) {
  const name = user?.full_name || user?.email?.split("@")[0] || "Learner";
  return (
    <section className="academy-enter relative mb-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(120deg,#f4a400_0%,#ff7615_48%,#f33e62_100%)] px-6 py-7 text-white shadow-[0_24px_46px_-28px_rgba(231,84,34,0.62)] sm:px-10 sm:py-9">
      <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border-[8px] border-white/15" />
      <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full border-[2px] border-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[#ffbe30]/25 blur-2xl" />
      <div className="relative max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"><Sparkles className="h-3.5 w-3.5" /> E-Course Professional</div>
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.05] tracking-[-0.05em] sm:text-[2.35rem]">Layer Poultry Farm Management</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85 sm:text-[0.95rem]">Dari pemula hingga expert — pelajari seluruh siklus produksi ayam petelur komersial: DOC → Brooding → Growing → Pre-lay → Peak → Post-peak → Molting → Spent Hen, dengan kombinasi video, materi baca, simulasi interaktif, kuis, case study, dan sertifikasi.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild className="bg-white text-[#b94716] shadow-sm hover:-translate-y-0.5 hover:bg-white/90"><Link to="/modules"><BookOpen /> Mulai belajar</Link></Button>
          <Button asChild variant="ghost" className="border border-white/20 bg-white/15 text-white shadow-none hover:bg-white/25 hover:text-white"><Link to="/ai-assistant"><Sparkles /> AI Farm Assistant</Link></Button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-white/75"><span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Selamat datang, {name}. Satu keputusan lebih baik setiap sesi.</div>
      </div>
    </section>
  );
}
