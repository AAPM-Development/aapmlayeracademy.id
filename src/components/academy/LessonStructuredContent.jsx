import React, { useMemo } from "react";
import {
  LessonChecklist,
  LessonInsightList,
  LessonSection,
} from "@/components/academy/LessonWorkspace";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  normaliseEditorialPresentation,
  parseEditorialDocument,
} from "@/lib/editorialDocument";
import { cn } from "@/lib/utils";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasListContent = (value) => Array.isArray(value)
  ? value.some((item) => hasText(String(item || "")))
  : hasText(value);
const listItems = (value) => Array.isArray(value)
  ? value.filter((item) => hasText(String(item || "")))
  : String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

const toneTextClass = (tone, fallback = "text-brand-green") => {
  if (tone === "orange") return "text-brand-orange";
  if (tone === "blue") return "text-brand-blue";
  if (tone === "violet") return "text-brand-violet";
  return fallback;
};

const toneIconTileClass = (tone, fallback = "green") => {
  if (tone === "orange") return "border-brand-orange/25 bg-brand-orange/10 text-brand-orange";
  if (tone === "blue") return "border-brand-blue/25 bg-brand-blue/10 text-brand-blue";
  if (tone === "violet") return "border-brand-violet/25 bg-brand-violet/10 text-brand-violet";
  if (fallback === "orange") return "border-brand-orange/25 bg-brand-orange/10 text-brand-orange";
  return "border-brand-green/25 bg-brand-green/10 text-brand-green";
};

const groupCountClass = (tone, fallback = "green") => {
  if (tone === "orange" || fallback === "orange") return "border-brand-orange/20 bg-brand-orange/5 text-brand-orange";
  if (tone === "blue") return "border-brand-blue/20 bg-brand-blue/5 text-brand-blue";
  if (tone === "violet") return "border-brand-violet/20 bg-brand-violet/5 text-brand-violet";
  return "border-brand-green/20 bg-brand-green/5 text-brand-green";
};

export function lessonPresentation(document) {
  return parseEditorialDocument(document)?.presentation || normaliseEditorialPresentation();
}

export function LessonObjectivesContent({ module, presentation }) {
  const config = normaliseEditorialPresentation(presentation).objectives;
  const columns = config.layout === "stacked" ? "grid-cols-1" : "sm:grid-cols-2";
  const gap = config.density === "compact" ? "gap-4" : "gap-5";
  const groupPadding = config.density === "compact" ? "p-3 sm:p-4" : "p-4 sm:p-5";
  const objectiveItems = listItems(module?.learningObjectives);
  const takeawayItems = listItems(module?.keyTakeaways);
  return (
    <div
      className={cn("grid", columns, gap)}
      data-lesson-objectives
      data-objectives-layout={config.layout}
      data-objectives-tone={config.tone}
      data-objectives-density={config.density}
    >
      {objectiveItems.length > 0 && (
        <div className={cn("min-w-0 rounded-[var(--radius-control)] border border-border/60 bg-surface-subtle/35", groupPadding)}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border", toneIconTileClass(config.tone))}>
                <AapmIcon name="target" className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 text-sm font-semibold tracking-tight">Tujuan pembelajaran</h3>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums", groupCountClass(config.tone))}>
              {objectiveItems.length} poin
            </span>
          </div>
          <LessonInsightList
            items={objectiveItems}
            density={config.density}
            iconClassName={toneTextClass(config.tone)}
          />
        </div>
      )}
      {takeawayItems.length > 0 && (
        <div className={cn("min-w-0 rounded-[var(--radius-control)] border border-border/60 bg-surface-subtle/35", groupPadding)}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border", toneIconTileClass("orange", "orange"))}>
                <AapmIcon name="info" className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 text-sm font-semibold tracking-tight">Inti pembelajaran</h3>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums", groupCountClass("orange", "orange"))}>
              {takeawayItems.length} poin
            </span>
          </div>
          <LessonInsightList
            items={takeawayItems}
            density={config.density}
            iconClassName="text-brand-orange"
          />
        </div>
      )}
    </div>
  );
}

export function LessonPracticalContent({ module, presentation }) {
  const config = normaliseEditorialPresentation(presentation).practical;
  const padding = config.density === "compact" ? "p-3 sm:p-4" : "p-5";
  const checklistPadding = config.density === "compact" ? "p-3 sm:p-4" : "p-4 sm:p-5";
  const checklistItems = listItems(module?.checklist);
  const assignmentPresent = hasText(module?.practicalAssignment);
  return (
    <div
      className="space-y-4"
      data-lesson-practical
      data-practical-tone={config.tone}
      data-practical-density={config.density}
      data-checklist-style={config.checklistStyle}
    >
      {assignmentPresent && (
        <div className={cn("max-w-3xl rounded-[var(--radius-control)] border border-border/60 bg-surface-subtle/35", padding)}>
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border", toneIconTileClass(config.tone, "green"))}>
              <AapmIcon name="target" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className={cn("text-sm font-semibold", toneTextClass(config.tone, "text-brand-green"))}>Tugas praktik</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {module.practicalAssignment}
            </p>
            </div>
          </div>
        </div>
      )}
      {hasListContent(module?.checklist) && (
        <div
          className={cn(
            "rounded-[var(--radius-control)] border border-border/60 bg-surface-subtle/35",
            checklistPadding,
            !assignmentPresent && "mt-0",
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-brand-green/25 bg-brand-green/10 text-brand-green">
                <AapmIcon name="checkRead" className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 text-sm font-semibold tracking-tight text-brand-green">Checklist observasi</h3>
            </div>
            <span className="shrink-0 rounded-full border border-brand-green/20 bg-brand-green/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-brand-green">
              {checklistItems.length} poin
            </span>
          </div>
          <LessonChecklist
            items={checklistItems}
            style={config.checklistStyle}
            density={config.density}
          />
        </div>
      )}
    </div>
  );
}

export function LessonStructuredContent({ module, document, withSectionIds = true }) {
  const presentation = useMemo(() => lessonPresentation(document || module?.editorialContent), [document, module?.editorialContent]);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  return <>
    {objectivesArePresent && <LessonSection id={withSectionIds ? "objectives" : undefined} title="Tujuan & insight" icon="target"><LessonObjectivesContent module={module} presentation={presentation} /></LessonSection>}
    {practiceIsPresent && <LessonSection id={withSectionIds ? "practical" : undefined} title="Praktik" icon="checkRead"><LessonPracticalContent module={module} presentation={presentation} /></LessonSection>}
  </>;
}
