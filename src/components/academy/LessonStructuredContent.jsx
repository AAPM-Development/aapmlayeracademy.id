import React, { useMemo } from "react";
import { Badge, IconTile } from "@/design-system";
import {
  LessonChecklist,
  LessonInsightList,
  LessonSection,
} from "@/components/academy/LessonWorkspace";
import {
  normaliseEditorialPresentation,
  parseEditorialDocument,
} from "@/lib/editorialDocument";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasListContent = (value) => Array.isArray(value)
  ? value.some((item) => hasText(String(item || "")))
  : hasText(value);
const listItems = (value) => Array.isArray(value)
  ? value.filter((item) => hasText(String(item || "")))
  : String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

// Authored presentation tones map onto the learning hue palette.
const toneHue = (tone, fallback = "green") => ({ green: "green", orange: "orange", blue: "blue", violet: "violet" }[tone] || fallback);

export function lessonPresentation(document) {
  return parseEditorialDocument(document)?.presentation || normaliseEditorialPresentation();
}

function Callout({ hue, icon, title, count, children }) {
  return (
    <div className="aapm-callout min-w-0" data-hue={hue}>
      <div className="aapm-callout__head">
        <IconTile icon={icon} hue={hue} size="sm" shape="circle" variant="badge" />
        <h3 className="aapm-callout__title min-w-0 flex-1">{title}</h3>
        {count ? <Badge hue={hue}>{count} poin</Badge> : null}
      </div>
      {children}
    </div>
  );
}

export function LessonObjectivesContent({ module, presentation }) {
  const config = normaliseEditorialPresentation(presentation).objectives;
  const objectiveItems = listItems(module?.learningObjectives);
  const takeawayItems = listItems(module?.keyTakeaways);
  return (
    <div
      className="aapm-callout-grid"
      data-layout={config.layout === "stacked" ? "stacked" : "split"}
      data-lesson-objectives
      data-objectives-layout={config.layout}
      data-objectives-tone={config.tone}
      data-objectives-density={config.density}
    >
      {objectiveItems.length > 0 && (
        <Callout hue={toneHue(config.tone)} icon="target" title="Tujuan pembelajaran" count={objectiveItems.length}>
          <LessonInsightList items={objectiveItems} density={config.density} />
        </Callout>
      )}
      {takeawayItems.length > 0 && (
        <Callout hue="orange" icon="insight" title="Inti pembelajaran" count={takeawayItems.length}>
          <LessonInsightList items={takeawayItems} density={config.density} />
        </Callout>
      )}
    </div>
  );
}

export function LessonPracticalContent({ module, presentation }) {
  const config = normaliseEditorialPresentation(presentation).practical;
  const checklistItems = listItems(module?.checklist);
  const assignmentPresent = hasText(module?.practicalAssignment);
  const hue = toneHue(config.tone, "teal");
  return (
    <div
      className="aapm-callout-grid"
      data-lesson-practical
      data-practical-tone={config.tone}
      data-practical-density={config.density}
      data-checklist-style={config.checklistStyle}
    >
      {assignmentPresent && (
        <Callout hue={hue} icon="practice" title="Tugas praktik">
          <p className="m-0 text-body">{module.practicalAssignment}</p>
        </Callout>
      )}
      {hasListContent(module?.checklist) && (
        <Callout hue="blue" icon="checkRead" title="Checklist observasi" count={checklistItems.length}>
          <LessonChecklist items={checklistItems} style={config.checklistStyle} density={config.density} />
        </Callout>
      )}
    </div>
  );
}

export function LessonStructuredContent({ module, document, withSectionIds = true }) {
  const presentation = useMemo(() => lessonPresentation(document || module?.editorialContent), [document, module?.editorialContent]);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  return (
    <>
      {objectivesArePresent && (
        <LessonSection id={withSectionIds ? "objectives" : undefined} title="Tujuan & insight" icon="target" hue="orange">
          <LessonObjectivesContent module={module} presentation={presentation} />
        </LessonSection>
      )}
      {practiceIsPresent && (
        <LessonSection id={withSectionIds ? "practical" : undefined} title="Praktik di kandang" icon="practice" hue="teal">
          <LessonPracticalContent module={module} presentation={presentation} />
        </LessonSection>
      )}
    </>
  );
}
