import React from "react";
import { Badge } from "@/design-system";
import { moduleLifecycleLabels } from "@/lib/curriculumState";

export function ModuleLifecycleStatus({ module }) {
  return <div className="flex flex-wrap gap-1" aria-label="Status modul">
    {moduleLifecycleLabels(module).map(({ label, tone }) => <Badge key={label} tone={tone}>{label}</Badge>)}
  </div>;
}

export function CourseLifecycleCounts({ counts = {} }) {
  return <div className="flex flex-wrap gap-2" aria-label="Jumlah modul menurut status">
    <Badge tone="warning">Draf: {counts.draft || 0}</Badge>
    <Badge tone="success">Terbit: {counts.published || 0}</Badge>
    <Badge tone="warning">Perubahan belum terbit: {counts.unpublished || 0}</Badge>
    <Badge tone="neutral">Arsip: {counts.archived || 0}</Badge>
  </div>;
}
