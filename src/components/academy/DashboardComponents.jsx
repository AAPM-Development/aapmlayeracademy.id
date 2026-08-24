import React from "react";
import { ArrowRight, Calculator, CheckCircle2, ChevronRight, Clock3, Gauge, PlayCircle, Sparkles, Target, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLevelProgress, learningLevels, TOTAL_MODULES } from "@/lib/academyData";

export function ContinueLearning({ module = null, progress = null } = {}) {
  if (!module) {
    return (
      <Card className="overflow-hidden border-brand-green/20 bg-brand-green/5 shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <Badge variant="outline" className="mb-3 border-brand-green/30 bg-background text-brand-green">Path complete</Badge>
            <h2 className="text-xl font-semibold tracking-tight">Semua modul sudah selesai.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tinjau kembali roadmap atau lanjutkan ke Final Exam.</p>
          </div>
          <Button asChild className="shrink-0 bg-brand-green text-white hover:bg-brand-green/90"><Link to="/final-exam">Buka Final Exam <ArrowRight /></Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-brand-orange/25 bg-surface-elevated shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-orange" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-brand-orange/30 bg-brand-orange/5 text-brand-orange">Continue learning</Badge>
              <span className="text-xs text-muted-foreground">Modul {module.moduleNumber} · Level {module.level}</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{module.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{module.summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild className="bg-brand-orange text-white hover:bg-brand-orange/90"><Link to={`/modules/${module.moduleNumber}`}>{progress?.completed ? "Review lesson" : "Resume lesson"} <ArrowRight /></Link></Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Fokus berikutnya di roadmap</span>
            </div>
          </div>
          <div className="hidden shrink-0 rounded-2xl bg-brand-orange/10 p-4 text-brand-orange sm:block">
            <PlayCircle className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Layer Farm Academy</div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Selamat datang, {name}.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Pilih satu langkah berikutnya. Academy menjaga progres Anda tetap terlihat dan dapat ditindaklanjuti.</p>
      </div>
      <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Trophy className="h-4 w-4 text-brand-orange" /> Professional learning track</div>
    </div>
  );
}
