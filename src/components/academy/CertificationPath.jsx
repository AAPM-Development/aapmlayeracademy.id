import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, ProgressRing } from "@/design-system";
import { hueFor } from "@/design-system/components/display";
import { certificationTiers, getCertificationState, getCompletedModuleSet } from "@/lib/academyData";
import AapmIcon from "@/components/icons/AapmIcon";

const statusMeta = {
  completed: { label: "Dimiliki", tone: "success", icon: "check" },
  eligible: { label: "Siap diklaim", tone: "attention", icon: "award" },
  "in-progress": { label: "Berjalan", tone: "info", icon: "pending" },
  locked: { label: "Terkunci", tone: "outline", icon: "lock" },
};

/** Six certification tiers as colourful badge cards with ring progress. */
export default function CertificationPath({ modules = [], progress = [], certificates = [], onClaim = (_tier) => {}, claiming = false } = {}) {
  const completedSet = getCompletedModuleSet(progress, modules);
  const finalPassed = progress.some((item) => Number(item?.moduleNumber) === 0 && item.completed);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {certificationTiers.map((tier) => {
        const state = getCertificationState(tier, completedSet, finalPassed, certificates);
        const meta = statusMeta[state.status];
        const hue = hueFor(tier.number);
        const percent = tier.modules.length ? Math.round((state.completed / tier.modules.length) * 100) : 0;
        return (
          <article key={tier.number} className="aapm-progress-tile" data-hue={hue} data-state={state.status}>
            <div className="aapm-progress-tile__head">
              <ProgressRing value={percent} size={56} stroke={6} hue={hue} label={`Tingkat ${tier.number} ${percent}%`}>
                <AapmIcon name={state.status === "locked" ? "lock" : "certificate"} />
              </ProgressRing>
              <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
            </div>
            <div>
              <p className="aapm-text-overline m-0">Tingkat {tier.number}</p>
              <h3 className="aapm-progress-tile__title">{tier.name}</h3>
              <p className="aapm-text-caption m-0">{tier.requiresFinal ? "Seluruh modul + ujian akhir" : `${tier.modules.length} modul wajib`}</p>
            </div>
            <div className="aapm-progress-tile__foot">
              <span>{state.completed}/{tier.modules.length} modul</span>
              {state.status === "eligible" ? (
                <Button size="sm" variant="learn" loading={claiming} onClick={() => onClaim(tier)}>Klaim</Button>
              ) : state.status === "locked" ? (
                <span className="aapm-text-caption">Terbuka setelah Tingkat {tier.number - 1} selesai</span>
              ) : state.status === "in-progress" ? (
                <Link to="/modules" className="aapm-link">Lanjutkan<AapmIcon name="chevronRight" /></Link>
              ) : (
                <span>{percent}%</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
