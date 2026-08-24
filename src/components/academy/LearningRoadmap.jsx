import React from "react";
import { Link } from "react-router-dom";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { LearningEmptyState } from "@/components/academy/LearningStates";
import { cn } from "@/lib/utils";
import { getLevelProgress, getModuleState, learningLevels } from "@/lib/academyData";

function ModuleStatus({ state = "locked" } = {}) {
  const config = {
    completed: { label: "Completed", icon: "check", className: "bg-success/10 text-success" },
    current: { label: "Current", icon: "solar:record-circle-bold", className: "bg-tint-lime text-tint-lime-foreground" },
    available: { label: "Available", icon: "solar:lock-keyhole-minimalistic-unlocked-bold", className: "bg-tint-blue text-tint-blue-foreground" },
    locked: { label: "Locked", icon: "lock", className: "bg-muted text-muted-foreground" },
  }[state] || { label: "Locked", icon: "lock", className: "bg-muted text-muted-foreground" };
  return <span role="status" aria-label={`Status: ${config.label}`} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", config.className)}><AapmIcon name={config.icon} className="h-3 w-3" /> {config.label}</span>;
}

function ModuleRow({ module = null, state = "locked" } = {}) {
  if (!module) return null;
  const content = (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors sm:items-center", state === "current" ? "border-tint-lime-border bg-tint-lime" : state === "available" ? "border-tint-blue-border bg-tint-blue/45" : state === "locked" ? "cursor-not-allowed border-border bg-surface-subtle" : "border-border bg-surface-elevated", state !== "locked" && "aapm-interactive-card")}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", state === "completed" ? "bg-success/10 text-success" : state === "current" ? "bg-brand-green text-white" : state === "available" ? "bg-tint-blue text-tint-blue-foreground" : "bg-muted text-muted-foreground")}>
        {state === "completed" ? <AapmIcon name="check" className="h-4 w-4" /> : state === "locked" ? <AapmIcon name="lock" className="h-4 w-4" /> : module.moduleNumber}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><div className="line-clamp-2 break-words text-sm font-medium">{module.title}</div><ModuleStatus state={state} /></div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{module.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>Modul {module.moduleNumber}</span><span>·</span><span>{module.category}</span></div>
      </div>
      {state !== "locked" && <AapmIcon name="chevronRight" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0" />}
    </div>
  );
  return state === "locked" ? <div aria-disabled="true" title="Selesaikan modul sebelumnya untuk membuka lesson ini.">{content}</div> : <Link to={`/modules/${module.moduleNumber}`} aria-current={state === "current" ? "step" : undefined} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{content}</Link>;
}

export default function LearningRoadmap({ modules = [], progress = [] } = {}) {
  const completedSet = new Set(progress.filter((item) => item?.completed).map((item) => item.moduleNumber));
  const sortedModules = [...modules].sort((a, b) => a.moduleNumber - b.moduleNumber);

  return (
    <div className="space-y-4">
      {learningLevels.map((level) => {
        const levelModules = sortedModules.filter((module) => module.level === level.number);
        if (!levelModules.length) return null;
        const stats = getLevelProgress(level.number, sortedModules, completedSet);
        return (
          <Card key={level.number} id={`level-${level.number}`} className="aapm-interactive-card overflow-hidden shadow-none">
            <CardHeader className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green/10 text-sm font-semibold text-brand-green">{level.number}</div>
                  <div><CardTitle className="text-base">{level.name}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">{level.description}</p></div>
                </div>
                <Badge variant="outline" className="w-fit border-border text-muted-foreground">{stats.completed}/{stats.total} selesai</Badge>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Progress ${level.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}><div className="h-full rounded-full bg-brand-green transition-[width]" style={{ width: `${stats.percent}%` }} /></div>
            </CardHeader>
            <CardContent className="space-y-2 p-4 sm:p-5">
              {levelModules.map((module) => <ModuleRow key={module.id || module.moduleNumber} module={module} state={getModuleState(module, sortedModules, completedSet)} />)}
            </CardContent>
          </Card>
        );
      })}
      {!modules.length && <LearningEmptyState title="Learning roadmap belum memiliki modul" description="Modul akan muncul di sini saat materi sudah tersedia untuk akun Anda." actionLabel={null} actionTo={null} />}
    </div>
  );
}
