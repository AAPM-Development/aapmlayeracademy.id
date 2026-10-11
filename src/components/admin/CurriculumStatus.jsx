import React from "react";
import { moduleLifecycleLabels } from "@/lib/curriculumState";

// Canvas status chips: Terbit green, pending changes amber, Draf plain, Arsip outline.
const CHIP = { Terbit: "chip-success", "Perubahan belum terbit": "chip-warning", Draf: "", Arsip: "chip-outline" };

export function ModuleLifecycleStatus({ module }) {
  return <div className="row wrap gap-1" aria-label="Status modul">
    {moduleLifecycleLabels(module).map(({ label }) => <span key={label} className={`chip ${CHIP[label] ?? ""} chip-dot`}>{label}</span>)}
  </div>;
}

/** @param {{ counts?: { draft?: number, published?: number, unpublished?: number, archived?: number } }} props */
export function CourseLifecycleCounts({ counts = {} }) {
  return <ul className="row wrap gap-2" aria-label="Jumlah modul per status">
    <li className="chip chip-success chip-dot">Terbit <span className="t-num">{counts.published || 0}</span></li>
    <li className="chip chip-warning chip-dot">Belum terbit <span className="t-num">{counts.unpublished || 0}</span></li>
    <li className="chip chip-dot">Draf <span className="t-num">{counts.draft || 0}</span></li>
    <li className="chip chip-outline chip-dot">Arsip <span className="t-num">{counts.archived || 0}</span></li>
  </ul>;
}
