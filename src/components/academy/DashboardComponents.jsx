import React from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CircularProgress,
  IconTile,
  KPICluster,
  Progress,
  Skeleton,
  Sparkline,
} from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import {
  getCompletedModuleSet,
  getLevelProgress,
  getProgressSummary,
  learningLevels,
  TOTAL_MODULES,
} from "@/lib/academyData";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function buildCourseSignal(modules = [], completedSet = new Set()) {
  const ordered = [...modules].sort(
    (a, b) => (a.moduleNumber || 0) - (b.moduleNumber || 0),
  );
  if (!ordered.length) return [0];

  let completed = 0;
  return [
    0,
    ...ordered.map((module) => {
      if (completedSet.has(Number(module.moduleNumber))) completed += 1;
      return Math.round((completed / ordered.length) * 100);
    }),
  ];
}

function buildQuizSignal(progress = []) {
  const values = [...progress]
    .filter((item) => item?.quizTotal)
    .sort((a, b) => (a.moduleNumber || 0) - (b.moduleNumber || 0))
    .map((item) =>
      clampPercent(((item.quizScore || 0) / item.quizTotal) * 100),
    );

  return values;
}

function DashboardRing({ value, label, className = "", size = 54 }) {
  return (
    <CircularProgress
      value={clampPercent(value)}
      label={label}
      size={size}
      className={cn("aapm-dashboard-ring", className)}
    />
  );
}

export function ContinueLearning({ module = null, progress = null } = {}) {
  if (!module) {
    return (
      <Card className="relative overflow-hidden border-brand-green/20 bg-brand-green/5 shadow-[var(--card-shadow)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand-green" />
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-green">
              Jalur belajar selesai
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              Semua modul sudah selesai.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tinjau kembali roadmap atau lanjutkan ke ujian akhir.
            </p>
          </div>
          <Button
            asChild
            className="shrink-0 bg-brand-green text-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-green/90"
          >
            <Link to="/final-exam">
              Buka ujian akhir <AapmIcon name="arrowRight" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group aapm-interactive-card relative overflow-hidden border-tint-lime-border bg-card shadow-[var(--card-shadow)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-lime" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Badge
                variant="soft"
                className="bg-tint-lime text-[10px] uppercase tracking-[0.14em] text-tint-lime-foreground"
              >
                Lanjutkan belajar
              </Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                Modul {module.moduleNumber} · Level {module.level}
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {module.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {module.summary}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to={`/modules/${module.moduleNumber}`}>
                  {progress?.completed ? "Tinjau materi" : "Buka materi"}{" "}
                  <AapmIcon name="arrowRight" />
                </Link>
              </Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <AapmIcon name="clock" className="h-3.5 w-3.5" /> Fokus
                berikutnya di roadmap
              </span>
            </div>
          </div>
          <div className="relative hidden h-24 w-24 shrink-0 items-center justify-center rounded-full border border-brand-lime/40 bg-tint-lime text-brand-green sm:flex">
            <div className="absolute inset-2 rounded-full border border-brand-green/15" />
            <AapmIcon
              name="solar:play-circle-bold"
              className="relative h-9 w-9 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMetricStrip({
  modules = [],
  progress = [],
  nextModule = null,
  isLoading = false,
} = {}) {
  if (isLoading) {
    return (
      <div
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Memuat ringkasan progress...</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--card-shadow)]"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>
    );
  }

  const progressSummary = getProgressSummary(modules, progress, TOTAL_MODULES);
  const { completed, total, percent: coursePercent, completedSet } = progressSummary;
  const scored = progress.filter((item) => item?.quizTotal);
  const average = scored.length
    ? Math.round(
        scored.reduce(
          (totalScore, item) =>
            totalScore + ((item.quizScore || 0) / item.quizTotal) * 100,
          0,
        ) / scored.length,
      )
    : 0;
  const activeLevel = nextModule
    ? learningLevels.find((level) => level.number === nextModule.level)
    : modules.length
      ? learningLevels[learningLevels.length - 1]
      : learningLevels[0];
  const activeLevelProgress = activeLevel
    ? getLevelProgress(activeLevel.number, modules, completedSet).percent
    : 0;
  const courseSignal = buildCourseSignal(modules, completedSet);
  const quizSignal = buildQuizSignal(progress);
  const metrics = [
    {
      value: `${completed}/${total}`,
      label: "Modul selesai",
      icon: "check",
      note: "Kemajuan tersimpan",
      tone: "success",
      colorway: 1,
      emphasis: "soft",
      chart: <Sparkline values={courseSignal} colorway={1} tone="success" label="Kemajuan modul tersimpan" />,
    },
    {
      value: `${coursePercent}%`,
      label: "Progress kursus",
      icon: "progress",
      note: "Ritme belajar saat ini",
      tone: "warning",
      colorway: 3,
      emphasis: "soft",
      progress: <Progress value={coursePercent} aria-label={`Progress kursus ${coursePercent}%`} className="aapm-dashboard-progress aapm-dashboard-progress--orange" />,
    },
    {
      value: `${average}%`,
      label: "Rata-rata nilai kuis",
      note: `${scored.length} kuis tersimpan`,
      icon: "analytics",
      tone: "info",
      colorway: 2,
      emphasis: "soft",
      ...(scored.length
        ? {
            progress: <Progress value={average} aria-label={`Rata-rata nilai kuis ${average}%`} className="aapm-dashboard-progress aapm-dashboard-progress--info" />,
          }
        : {}),
      ...(quizSignal.length >= 2
        ? {
            chart: <Sparkline values={quizSignal} colorway={2} tone="info" label="Sinyal nilai kuis" />,
          }
        : {}),
    },
    {
      value: activeLevel?.name || "Foundation",
      label: "Level saat ini",
      note: `${activeLevelProgress}% level terselesaikan`,
      icon: "approve",
      tone: "accent",
      colorway: 4,
      emphasis: "soft",
      progress: <Progress value={activeLevelProgress} aria-label={`Progress level ${activeLevel?.name || "saat ini"} ${activeLevelProgress}%`} className="aapm-dashboard-progress aapm-dashboard-progress--green" />,
    },
  ];

  return (
    <KPICluster
      className="mb-6 aapm-dashboard-kpi"
      label="Ringkasan perjalanan belajar"
      columns={4}
      variant="cards"
      items={metrics}
    />
  );
}

const dashboardTracks = [
  {
    name: "Beginner",
    description: "Bangun fondasi flock dan ritme kerja yang konsisten.",
    levels: [1, 2, 3, 4, 5],
    tone: "green",
    icon: "course",
  },
  {
    name: "Intermediate",
    description: "Hubungkan lingkungan, biosecurity, telur, dan KPI.",
    levels: [6, 7, 8, 9, 10, 11],
    tone: "lime",
    icon: "solar:shield-check-bold",
  },
  {
    name: "Advanced",
    description: "Kelola operasi dengan root cause analysis dan disiplin data.",
    levels: [12, 13],
    tone: "orange",
    icon: "analytics",
  },
  {
    name: "Expert",
    description: "Ambil keputusan lintas fungsi dan pimpin perbaikan farm.",
    levels: [14],
    tone: "neutral",
    icon: "solar:cup-star-bold",
  },
];

export function LearningTracks({ modules = [], progress = [] } = {}) {
  const completedSet = getCompletedModuleSet(progress, modules);
  const tones = {
    green: {
      card: "border-tint-green-border bg-tint-green",
      bar: "bg-tint-green-foreground",
      label: "text-tint-green-foreground",
    },
    lime: {
      card: "border-tint-lime-border bg-tint-lime",
      bar: "bg-tint-lime-foreground",
      label: "text-tint-lime-foreground",
    },
    orange: {
      card: "border-tint-orange-border bg-tint-orange",
      bar: "bg-tint-orange-foreground",
      label: "text-tint-orange-foreground",
    },
    neutral: {
      card: "border-border bg-surface-subtle",
      bar: "bg-muted-foreground",
      label: "text-foreground",
    },
  };

  return (
    <section className="academy-enter mt-8" style={{ animationDelay: "180ms" }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">
            Jalur belajar
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            Jalur pembelajaran
          </h2>
        </div>
        <Link
          to="/modules"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
        >
          Lihat semua <AapmIcon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {dashboardTracks.map((track) => {
          const tone = tones[track.tone];
          const stats = track.levels.reduce(
            (result, levelNumber) => {
              const levelStats = getLevelProgress(
                levelNumber,
                modules,
                completedSet,
              );
              return {
                completed: result.completed + levelStats.completed,
                total: result.total + levelStats.total,
              };
            },
            { completed: 0, total: 0 },
          );
          const percent = stats.total
            ? Math.round((stats.completed / stats.total) * 100)
            : 0;
          const levelNames = track.levels
            .map(
              (levelNumber) =>
                learningLevels.find((level) => level.number === levelNumber)
                  ?.name,
            )
            .filter(Boolean);

          return (
            <Link
              key={track.name}
              to="/modules"
              className={cn(
                "group aapm-interactive-card overflow-hidden rounded-[var(--card-radius)] border p-5",
                tone.card,
              )}
            >
              <div className="flex items-start gap-3">
                <IconTile icon={track.icon} tone={track.tone} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={cn("text-base font-semibold", tone.label)}>
                      {track.name}
                    </h3>
                    <AapmIcon
                      name="arrowRight"
                      className={cn(
                        "h-4 w-4 transition-transform duration-300 group-hover:translate-x-1",
                        tone.label,
                      )}
                    />
                  </div>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    {track.description}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {stats.completed}/{stats.total || "—"} modul selesai
                </span>
                <Badge
                  variant="soft"
                  className="bg-white/70 text-[10px] text-muted-foreground"
                >
                  {track.levels.length} level
                </Badge>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    tone.bar,
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-3 truncate text-[11px] text-muted-foreground/80">
                {levelNames.slice(0, 4).join(" · ")}
                {levelNames.length > 4 ? " · …" : ""}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function LearningProgressSummary({ modules = [], progress = [] } = {}) {
  const progressSummary = getProgressSummary(modules, progress, TOTAL_MODULES);
  const { completed, total, percent } = progressSummary;
  const scored = progress.filter((item) => item?.quizTotal);
  const average = scored.length
    ? Math.round(
        scored.reduce(
          (total, item) =>
            total + ((item.quizScore || 0) / item.quizTotal) * 100,
          0,
        ) / scored.length,
      )
    : 0;
  const hasProgress = progress.length > 0;

  return (
    <Card className="bg-card/95">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Progress belajar</CardTitle>
            <CardDescription className="mt-1">
              Ritme belajar Anda di Academy.
            </CardDescription>
          </div>
          <IconTile icon="progress" tone="green" size="sm" />
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
        {hasProgress ? (
          <div className="flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold tracking-tight">
              {percent}%
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {completed}/{total} modul selesai
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-4">
            <div className="text-sm font-medium text-foreground">
              Mulai dari lesson pertama
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Progress Anda akan muncul setelah menyelesaikan satu modul.
            </p>
            <Link
              to="/modules"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
            >
              Buka jalur belajar{" "}
              <AapmIcon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <Progress
          value={percent}
          className="mt-3 h-2 bg-muted [&>div]:bg-brand-green"
        />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <div className="text-lg font-semibold">{average}%</div>
            <div className="text-xs text-muted-foreground">Rata-rata kuis</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{scored.length}</div>
            <div className="text-xs text-muted-foreground">Kuis tersimpan</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LearningJourney({ modules = [], progress = [] } = {}) {
  const completedSet = getCompletedModuleSet(progress, modules);

  return (
    <Card className="bg-card/95">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Perjalanan belajar</CardTitle>
            <CardDescription className="mt-1">
              14 level yang membentuk jalur kompetensi Anda.
            </CardDescription>
          </div>
          <Link
            to="/modules"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
          >
            Lihat path <AapmIcon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
        {!modules.length ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-4 text-sm text-muted-foreground">
            Perjalanan belajar akan terisi setelah roadmap tersedia.{" "}
            <Link
              to="/modules"
              className="font-semibold text-brand-green hover:underline"
            >
              Buka jalur
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {learningLevels.slice(0, 6).map((level) => {
              const stats = getLevelProgress(
                level.number,
                modules,
                completedSet,
              );
              const active =
                stats.completed > 0 && stats.completed < stats.total;
              const done = stats.total > 0 && stats.completed === stats.total;
              return (
                <Link
                  key={level.number}
                  to="/modules"
                  className="group rounded-xl border border-border p-3 transition-colors hover:border-brand-green/40 hover:bg-brand-green/5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        done
                          ? "bg-success/15 text-success"
                          : active
                            ? "bg-brand-orange/15 text-brand-orange"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <AapmIcon name="check" className="h-4 w-4" />
                      ) : (
                        level.number
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">
                          {level.name}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {stats.completed}/{stats.total || "—"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            done ? "bg-success" : "bg-brand-lime",
                          )}
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-lime" /> Progress
          detail tersedia di jalur belajar.
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickToolGrid() {
  const tools = [
    {
      to: "/calculators",
      label: "Kalkulator farm",
      description: "Hitung indikator operasional.",
      icon: "solar:calculator-bold-duotone",
      tone: "lime",
    },
    {
      to: "/kpi",
      label: "Farm KPI",
      description: "Review data produksi.",
      icon: "kpi",
      tone: "green",
    },
    {
      to: "/ai-assistant",
      label: "APPI",
      description: "Tanya dengan konteks farm.",
      icon: "ai",
      tone: "orange",
    },
  ];

  return (
    <Card className="bg-card/95">
      <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
        <CardTitle className="text-base">Alat cepat</CardTitle>
        <CardDescription className="mt-1">
          Alat bantu saat Anda belajar.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 p-5 pt-2 sm:p-6 sm:pt-2">
        {tools.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="group aapm-interactive-card flex items-center gap-3 rounded-xl border border-border p-3"
          >
            <IconTile icon={tool.icon} tone={tool.tone} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{tool.label}</div>
              <div className="truncate text-xs text-muted-foreground">
                {tool.description}
              </div>
            </div>
            <AapmIcon
              name="chevronRight"
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardWelcome({
  user = null,
  nextModule = null,
  modules = [],
  progress = [],
} = {}) {
  const name = user?.full_name || user?.email?.split("@")[0] || "Learner";
  const progressSummary = getProgressSummary(modules, progress, TOTAL_MODULES);
  const { completed, total, percent: coursePercent } = progressSummary;
  const focusLabel = nextModule
    ? `M${nextModule.moduleNumber}`
    : total > 0 && completed >= total
      ? "✓"
      : "—";
  const cycle = [
    "DOC & brooding",
    "Growing",
    "Pre-lay",
    "Peak production",
    "Layer management",
    "Molting & akhir flock",
  ];

  return (
    <section className="academy-enter mb-6 overflow-hidden rounded-[calc(var(--card-radius)_+_0.25rem)] border border-border bg-card shadow-[var(--surface-shadow)]">
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <div className="relative overflow-hidden bg-brand-green px-5 py-6 text-white sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border-[18px] border-brand-lime/15" />
          <div className="pointer-events-none absolute bottom-0 right-16 h-20 w-20 rounded-full border border-brand-orange/30" />
          <div className="relative">
            <Badge
              variant="soft"
              className="border border-white/20 bg-white/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-none"
            >
              <AapmIcon name="ai" className="shrink-0 text-[11px]" /> Ruang belajar
            </Badge>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[2.55rem]">
              Selamat datang, {name}.
              <span className="mt-1 block text-brand-lime">Belajar dengan arah.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-[0.95rem]">
              Baca sinyal farm, kuasai konsep inti, lalu bawa keputusan yang lebih presisi kembali ke lapangan.
            </p>
            <div className="mt-5 flex max-w-xl flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-white/15 rounded-xl border border-white/15 bg-white/5">
                <div className="px-3 py-3 sm:px-4"><div className="text-lg font-semibold">{total}</div><div className="mt-0.5 text-[10px] text-white/65">modul inti</div></div>
                <div className="px-3 py-3 sm:px-4"><div className="text-lg font-semibold">{learningLevels.length}</div><div className="mt-0.5 text-[10px] text-white/65">tingkat belajar</div></div>
                <div className="px-3 py-3 sm:px-4"><div className="text-lg font-semibold text-brand-lime">{focusLabel}</div><div className="mt-0.5 text-[10px] text-white/65">fokus berikutnya</div></div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-black/10 px-3 py-2.5">
                <DashboardRing
                  value={coursePercent}
                  label={`Progress kursus ${coursePercent}%`}
                  size={58}
                  className="aapm-dashboard-ring--hero"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Perjalanan kursus</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">{completed}/{total} modul</div>
                  <div className="mt-0.5 text-[10px] text-white/60">Progress tersimpan</div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid w-full max-w-xl gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <Button asChild className="h-11 w-full bg-brand-orange px-4 text-white shadow-sm hover:bg-brand-orange/90 sm:w-auto">
                <Link
                  to={nextModule ? `/modules/${nextModule.moduleNumber}` : "/modules"}
                  className="inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap"
                >
                  <AapmIcon name="course" className="shrink-0" /> {nextModule ? "Lanjutkan belajar" : "Buka jalur belajar"}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 w-full border border-white/[0.35] bg-white/[0.05] px-4 text-white shadow-none hover:bg-white/[0.12] hover:text-white sm:w-auto">
                <Link to="/ai-assistant" className="inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap">
                  <AapmIcon name="ai" className="shrink-0" /> Tanya APPI
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <aside className="flex min-h-full flex-col border-t border-border bg-surface-subtle p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Rute sesi ini</div>
              <div className="mt-1 text-base font-semibold text-foreground">Satu keputusan, satu langkah.</div>
            </div>
            <IconTile icon="solar:route-bold-duotone" tone="orange" size="sm" />
          </div>
          <div className="mt-5 rounded-xl border border-tint-orange-border bg-tint-orange p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-tint-orange-foreground/75">Fokus berikutnya</div>
            <div className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{nextModule?.title || "Pilih modul pertama Anda"}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{nextModule ? `Modul ${nextModule.moduleNumber} · ${nextModule.category || "Academy"}` : "Roadmap akan memandu urutannya."}</div>
          </div>
          <ol className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            {cycle.map((phase, index) => (
              <li key={phase} className="flex min-w-0 items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-semibold tabular-nums text-brand-orange shadow-sm">{index + 1}</span>
                <span className="truncate pt-0.5 text-[11px] font-medium leading-4 text-foreground">{phase}</span>
              </li>
            ))}
          </ol>
          <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs">
            <span className="text-muted-foreground">6 fase utama</span>
            <Link to="/modules" className="inline-flex items-center gap-1 font-semibold text-brand-green hover:text-brand-green/80">Lihat roadmap <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
