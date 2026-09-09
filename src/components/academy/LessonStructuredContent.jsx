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

export function lessonPresentation(document) {
  return parseEditorialDocument(document)?.presentation || normaliseEditorialPresentation();
}

export function LessonObjectivesContent({ module, presentation }) {
  const config = normaliseEditorialPresentation(presentation).objectives;
  const columns = config.layout === "stacked" ? "grid-cols-1" : "sm:grid-cols-2";
  const gap = config.density === "compact" ? "gap-4" : "gap-5";
  return (
    <div
      className={cn("grid border-y border-border/70 py-4 sm:py-5", columns, gap)}
      data-lesson-objectives
      data-objectives-layout={config.layout}
      data-objectives-tone={config.tone}
      data-objectives-density={config.density}
    >
      {hasListContent(module?.learningObjectives) && (
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AapmIcon
              name="target"
              className={cn("h-4 w-4 shrink-0", toneTextClass(config.tone))}
            />
            <span>Tujuan pembelajaran</span>
          </div>
          <LessonInsightList
            items={listItems(module.learningObjectives)}
            icon="target"
            density={config.density}
            iconClassName={toneTextClass(config.tone)}
          />
        </div>
      )}
      {hasListContent(module?.keyTakeaways) && (
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AapmIcon name="info" className="h-4 w-4 shrink-0 text-brand-orange" />
            <span>Inti pembelajaran</span>
          </div>
          <LessonInsightList
            items={listItems(module.keyTakeaways)}
            icon="info"
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
        <div className={cn("max-w-3xl", padding)}>
          <div className="min-w-0">
            <div className={cn("mb-1 text-sm font-semibold", toneTextClass(config.tone, "text-brand-green"))}>Tugas praktik</div>
            <p className="text-sm leading-6 text-muted-foreground">
              {module.practicalAssignment}
            </p>
          </div>
        </div>
      )}
      {hasListContent(module?.checklist) && (
        <div
          className={cn(
            "border-t border-border/70 pt-3",
            checklistPadding,
            !assignmentPresent && "border-t-0 pt-0",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <AapmIcon name="checkRead" className="h-4 w-4 text-brand-green" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-green">
              Checklist observasi
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
