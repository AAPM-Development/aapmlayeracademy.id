import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, IconTile, Surface } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { certificationTiers, getCertificationState, getCompletedModuleSet } from "@/lib/academyData";
import AapmIcon from "@/components/icons/AapmIcon";

const tierTones = ["green", "lime", "orange", "green", "lime", "orange"];
const progressTones = {
  green: "bg-tint-green-foreground",
  lime: "bg-tint-lime-foreground",
  orange: "bg-tint-orange-foreground",
};

function TierIcon({ status = "locked" } = {}) {
  if (status === "completed") return <AapmIcon name="checkRead" />;
  if (status === "eligible") return <AapmIcon name="award" />;
  if (status === "in-progress") return <AapmIcon name="circle" />;
  return <AapmIcon name="lock" />;
}

export default function CertificationPath({ modules = [], progress = [], certificates = [], onClaim = (_tier) => {}, claiming = false } = {}) {
  const completedSet = getCompletedModuleSet(progress, modules);
  const finalPassed = progress.some((item) => Number(item?.moduleNumber) === 0 && item.completed);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {certificationTiers.map((tier, index) => {
        const state = getCertificationState(tier, completedSet, finalPassed, certificates);
        const tone = tierTones[index % tierTones.length];
        const percent = tier.modules.length ? Math.round((state.completed / tier.modules.length) * 100) : 0;
        const statusLabel = state.status === "completed" ? "Completed" : state.status === "eligible" ? "Eligible" : state.status === "in-progress" ? "In progress" : "Locked";
        return (
          <Surface key={tier.number} variant="interactive" className={cn("group overflow-hidden p-4 sm:p-5", state.status === "eligible" && "border-brand-orange/45", state.status === "completed" && "border-success/35")}>
            <div className="flex items-start gap-3">
              <IconTile icon="solar:medal-star-bold-duotone" tone={tone} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tier {tier.number}</span><Badge variant="outline" className="border-border text-[10px]">{statusLabel}</Badge></div><span className="text-xs font-semibold tabular-nums text-muted-foreground">{percent}%</span></div>
                <h3 className="mt-2 text-base font-semibold">{tier.name}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tier.requiresFinal ? "22 modul + ujian akhir" : `${tier.modules.length} modul wajib`}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3"><div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-[width] duration-500", state.status === "completed" ? "bg-success" : state.status === "eligible" ? "bg-brand-orange" : progressTones[tone])} style={{ width: `${percent}%` }} /></div><span className="shrink-0 text-[11px] text-muted-foreground">{state.completed}/{tier.modules.length}</span></div>
            <div className="mt-4 flex min-h-8 items-center justify-between gap-3 border-t border-border pt-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TierIcon status={state.status} />{state.status === "completed" ? "Bukti tersimpan" : state.status === "eligible" ? "Siap diklaim" : state.status === "in-progress" ? "Lanjutkan roadmap" : "Selesaikan prasyarat"}</div><div>{state.status === "eligible" && <Button type="button" size="sm" onClick={() => onClaim(tier)} disabled={claiming}>Klaim <AapmIcon name="arrowRight" /></Button>}{state.status === "completed" && <span className="text-xs font-semibold text-success">Dimiliki</span>}{state.status === "locked" && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><AapmIcon name="lock" /> Terkunci</span>}{state.status === "in-progress" && <Link to="/modules" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">Lanjutkan <AapmIcon name="chevronRight" /></Link>}</div></div>
          </Surface>
        );
      })}
    </div>
  );
}
