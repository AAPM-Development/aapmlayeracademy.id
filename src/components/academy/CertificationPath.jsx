import React from "react";
import { Award, CheckCircle2, ChevronRight, Circle, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { certificationTiers, getCertificationState } from "@/lib/academyData";

function TierIcon({ status = "locked" } = {}) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5" />;
  if (status === "eligible") return <Award className="h-5 w-5" />;
  if (status === "in-progress") return <Circle className="h-5 w-5" />;
  return <LockKeyhole className="h-5 w-5" />;
}

export default function CertificationPath({ progress = [], certificates = [], onClaim = (_tier) => {}, claiming = false } = {}) {
  const completedSet = new Set(progress.filter((item) => item?.completed).map((item) => item.moduleNumber));
  const finalPassed = progress.some((item) => item.moduleNumber === 0 && item.completed);

  return (
    <div className="space-y-3">
      {certificationTiers.map((tier) => {
        const state = getCertificationState(tier, completedSet, finalPassed, certificates);
        return (
          <Card key={tier.number} className={cn("shadow-none", state.status === "eligible" && "border-brand-orange/35", state.status === "completed" && "border-success/30")}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", state.status === "completed" ? "bg-success/10 text-success" : state.status === "eligible" ? "bg-brand-orange/10 text-brand-orange" : state.status === "in-progress" ? "bg-info/10 text-info" : "bg-muted text-muted-foreground")}><TierIcon status={state.status} /></div>
              <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tier {tier.number}</span><Badge variant="outline" className="border-border text-[10px]">{state.status === "completed" ? "Completed" : state.status === "eligible" ? "Eligible" : state.status === "in-progress" ? "In progress" : "Locked"}</Badge></div><CardTitle className="text-base">{tier.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{tier.requiresFinal ? "22 modul + Final Exam" : `${tier.modules.length} modul wajib`}</p><div className="mt-3 flex items-center gap-3"><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", state.status === "completed" ? "bg-success" : "bg-brand-orange")} style={{ width: `${tier.modules.length ? (state.completed / tier.modules.length) * 100 : 0}%` }} /></div><span className="shrink-0 text-[11px] text-muted-foreground">{state.completed}/{tier.modules.length}</span></div></div>
              <div className="flex shrink-0 items-center justify-end gap-2">{state.status === "eligible" && <Button type="button" size="sm" onClick={() => onClaim(tier)} disabled={claiming} className="bg-brand-orange text-white hover:bg-brand-orange/90">Klaim</Button>}{state.status === "completed" && <span className="text-xs font-semibold text-success">Dimiliki</span>}{state.status === "locked" && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Terkunci</span>}{state.status === "in-progress" && <Link to="/modules" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">Lanjutkan <ChevronRight className="h-3.5 w-3.5" /></Link>}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
