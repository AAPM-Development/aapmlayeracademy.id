import React from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/primitives";
import { LearningEmptyState } from "@/components/academy/LearningStates";
import { cn } from "@/lib/utils";
import {
  getCompletedModuleSet,
  getLevelProgress,
  getModuleState,
  learningLevels,
} from "@/lib/academyData";

const learningTracks = [
  { key: "foundation", kicker: "Bab 01", title: "Fondasi flock", description: "Bangun cara berpikir sistem sebelum masuk ke keputusan produksi.", levels: [1, 2, 3], icon: "solar:layers-bold-duotone", accent: "green" },
  { key: "production", kicker: "Bab 02", title: "Sistem produksi", description: "Hubungkan pakan, air, dan lingkungan menjadi ritme operasional.", levels: [4, 5, 6], icon: "solar:settings-minimalistic-bold-duotone", accent: "orange" },
  { key: "control", kicker: "Bab 03", title: "Kontrol mutu & data", description: "Jaga kesehatan, biosecurity, kualitas telur, dan sinyal KPI.", levels: [7, 8, 9, 10], icon: "solar:chart-square-bold-duotone", accent: "lime" },
  { key: "leadership", kicker: "Bab 04", title: "Keputusan & kepemimpinan", description: "Naik dari membaca angka menjadi memimpin perbaikan farm.", levels: [11, 12, 13, 14], icon: "solar:cup-star-bold-duotone", accent: "neutral" },
];

const accentStyles = {
  green: { section: "border-tint-green-border bg-tint-green/30", icon: "bg-tint-green text-tint-green-foreground", line: "bg-brand-green" },
  orange: { section: "border-tint-orange-border bg-tint-orange/30", icon: "bg-tint-orange text-tint-orange-foreground", line: "bg-brand-orange" },
  lime: { section: "border-tint-lime-border bg-tint-lime/30", icon: "bg-tint-lime text-tint-lime-foreground", line: "bg-brand-lime" },
  neutral: { section: "border-border bg-surface-subtle", icon: "bg-surface-inset text-muted-foreground", line: "bg-muted-foreground" },
};

const moduleIdentity = {
  1: { icon: "solar:leaf-bold-duotone", tone: "green" },
  2: { icon: "modules", tone: "green" },
  3: { icon: "progress", tone: "orange" },
  4: { icon: "egg", tone: "orange" },
  5: { icon: "solar:waterdrops-bold-duotone", tone: "lime" },
  6: { icon: "solar:wind-bold-duotone", tone: "lime" },
  7: { icon: "solar:medical-kit-bold", tone: "orange" },
  8: { icon: "shield", tone: "green" },
  9: { icon: "solar:clipboard-check-bold-duotone", tone: "orange" },
  10: { icon: "kpi", tone: "lime" },
  11: { icon: "finance", tone: "orange" },
  12: { icon: "course", tone: "green" },
  13: { icon: "analytics", tone: "orange" },
  14: { icon: "award", tone: "orange" },
};

const moduleIdentityStyles = {
  green: "bg-tint-green text-tint-green-foreground",
  orange: "bg-tint-orange text-tint-orange-foreground",
  lime: "bg-tint-lime text-tint-lime-foreground",
};

const statusMeta = {
  completed: { label: "Selesai", icon: "solar:check-circle-bold", className: "bg-success/10 text-success" },
  current: { label: "Lanjutkan", icon: "solar:play-circle-bold-duotone", className: "bg-tint-orange text-tint-orange-foreground" },
  available: { label: "Tersedia", icon: "solar:lock-keyhole-minimalistic-unlocked-bold-duotone", className: "bg-surface-inset text-muted-foreground" },
  locked: { label: "Terkunci", icon: "solar:lock-keyhole-bold-duotone", className: "bg-muted text-muted-foreground" },
};

function ModuleStatus({ state }) {
  const meta = statusMeta[state] || statusMeta.locked;
  return (
    <span role="status" aria-label={`Status: ${meta.label}`} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", meta.className)}>
      <AapmIcon name={meta.icon} className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function ModuleTile({ module, state }) {
  if (!module) return null;
  const isCurrent = state === "current";
  const identity = moduleIdentity[module.level] || moduleIdentity[1];
  const tile = (
    <div className={cn(
      "group relative min-w-0 overflow-hidden rounded-xl border p-3.5 transition-[border-color,box-shadow,transform,background-color] sm:p-4",
      isCurrent && "border-brand-orange/45 bg-tint-orange shadow-[0_10px_30px_hsl(var(--aapm-orange-700)/0.10)]",
      state === "completed" && "border-border bg-background",
      state === "available" && "border-border bg-background",
      state === "locked" && "cursor-not-allowed border-border/75 bg-surface-subtle/65",
      state !== "locked" && "hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-md",
    )}>
      {isCurrent && <span className="absolute inset-y-0 left-0 w-1 bg-brand-orange" />}
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
          state === "completed" && "bg-tint-green text-brand-green",
          isCurrent && "bg-brand-orange text-white",
          state === "available" && "bg-surface-inset text-muted-foreground",
          state === "locked" && "bg-muted text-muted-foreground",
        )}>
          {state === "completed" ? <AapmIcon name="solar:check-read-bold-duotone" className="h-5 w-5" /> : state === "locked" ? <AapmIcon name="solar:lock-keyhole-bold-duotone" className="h-4 w-4" /> : String(module.moduleNumber).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-md", moduleIdentityStyles[identity.tone])}>
                  <AapmIcon name={identity.icon} className="h-3 w-3" />
                </span>
                <span className="truncate">Modul {module.moduleNumber} · {module.category}</span>
              </p>
              <h4 className="mt-1 line-clamp-2 text-sm font-semibold tracking-[-0.015em] text-foreground">{module.title}</h4>
            </div>
            <ModuleStatus state={state} />
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{module.summary}</p>
          {isCurrent && <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-orange">Buka materi <AapmIcon name="solar:arrow-right-bold" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>}
        </div>
      </div>
    </div>
  );

  if (state === "locked") return <div aria-disabled="true" title="Selesaikan modul sebelumnya untuk membuka lesson ini.">{tile}</div>;
  return <Link to={`/modules/${module.moduleNumber}`} aria-current={isCurrent ? "step" : undefined} className={cn("block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isCurrent && "md:col-span-2")}>{tile}</Link>;
}

function LevelCard({ level, modules, allModules, completedSet, accent }) {
  const stats = getLevelProgress(level.number, allModules, completedSet);
  const moduleStates = modules.map((module) => getModuleState(module, allModules, completedSet));
  const hasCurrent = moduleStates.includes("current");

  return (
    <AccordionItem id={`level-${level.number}`} value={`level-${level.number}`} className={cn("group/level h-fit min-w-0 self-start overflow-hidden rounded-2xl border bg-background shadow-sm transition-[border-color,box-shadow]", hasCurrent && "ring-1 ring-brand-orange/20 lg:col-span-2", "data-[state=open]:border-brand-green/35 data-[state=open]:shadow-[var(--surface-shadow-hover)]")}>
      <AccordionTrigger className="group/header relative w-full px-4 py-4 hover:no-underline sm:px-5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted-foreground">
        <span className={cn("absolute inset-y-0 left-0 w-1", accent.line)} />
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", accent.icon)}>{String(level.number).padStart(2, "0")}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-[-0.015em] sm:text-base">{level.name}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{level.description}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-muted-foreground">{stats.completed}/{stats.total}</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Progress ${level.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}>
          <div className={cn("h-full rounded-full transition-[width]", accent.line)} style={{ width: `${stats.percent}%` }} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border">
        <div className="grid min-w-0 gap-2.5 p-3.5 sm:p-4 md:grid-cols-2">
          {modules.map((module, index) => <ModuleTile key={module.id || module.moduleNumber} module={module} state={moduleStates[index]} />)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function LearningRoadmap({ modules = [], progress = [] }) {
  const completedSet = getCompletedModuleSet(progress, modules);
  const sortedModules = [...modules].sort((left, right) => left.moduleNumber - right.moduleNumber);
  if (!modules.length) return <LearningEmptyState title="Learning roadmap belum memiliki modul" description="Modul akan muncul di sini saat materi sudah tersedia untuk akun Anda." actionLabel={null} actionTo={null} />;

  return (
    <div className="space-y-7 sm:space-y-9">
      {learningTracks.map((track) => {
        const levels = learningLevels.filter((level) => track.levels.includes(level.number));
        const trackModules = sortedModules.filter((module) => track.levels.includes(module.level));
        const trackCompleted = trackModules.filter((module) => completedSet.has(Number(module.moduleNumber))).length;
        const accent = accentStyles[track.accent];
        return (
          <section key={track.key} className="min-w-0">
            <div className={cn("mb-3 flex min-w-0 flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5", accent.section)}>
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent.icon)}><AapmIcon name={track.icon} className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{track.kicker}</p>
                  <h2 className="mt-0.5 text-lg font-semibold tracking-[-0.025em]">{track.title}</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{track.description}</p>
                </div>
              </div>
              <span className="shrink-0 self-start rounded-full bg-background/80 px-3 py-1.5 text-[10px] font-semibold text-foreground shadow-sm sm:self-auto">{trackCompleted}/{trackModules.length} modul selesai</span>
            </div>
            <Accordion type="multiple" defaultValue={[]} className="grid min-w-0 items-start gap-3 lg:auto-rows-max lg:grid-cols-2" aria-label={`${track.title} learning levels`}>
              {levels.map((level) => {
                const levelModules = sortedModules.filter((module) => module.level === level.number);
                if (!levelModules.length) return null;
                return <LevelCard key={level.number} level={level} modules={levelModules} allModules={sortedModules} completedSet={completedSet} accent={accent} />;
              })}
            </Accordion>
          </section>
        );
      })}
    </div>
  );
}
