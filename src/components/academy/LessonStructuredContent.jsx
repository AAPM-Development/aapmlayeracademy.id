import React, { useMemo, useState } from "react";
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

function Callout({ hue, title, count, children }) {
  return (
    <div className="callout" data-hue={hue} style={{ minWidth: 0 }}>
      <div className="row between gap-2">
        <span className="t-support t-strong">{title}</span>
        {count ? <span className="chip chip-hue">{count} poin</span> : null}
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
      className={config.layout === "stacked" ? "stack gap-grid" : "split-even"}
      data-lesson-objectives
      data-objectives-layout={config.layout}
      data-objectives-tone={config.tone}
      data-objectives-density={config.density}
    >
      {objectiveItems.length > 0 && (
        <Callout hue={toneHue(config.tone)} title="Tujuan pembelajaran" count={objectiveItems.length}>
          <LessonInsightList items={objectiveItems} density={config.density} />
        </Callout>
      )}
      {takeawayItems.length > 0 && (
        <Callout hue="violet" title="Inti pembelajaran" count={takeawayItems.length}>
          <LessonInsightList items={takeawayItems} density={config.density} />
        </Callout>
      )}
    </div>
  );
}

function ObservationChecklist({ items, config }) {
  const [count, setCount] = useState(0);
  return (
    <div className="card card-pad stack gap-3">
      <div className="row between"><span className="t-support t-strong">Checklist observasi</span>{config.checklistStyle === "list" ? null : <span className="t-caption t-muted t-num">{count}/{items.length} dicatat</span>}</div>
      <LessonChecklist items={items} style={config.checklistStyle} density={config.density} onCountChange={setCount} />
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
      className="stack gap-grid"
      data-lesson-practical
      data-practical-tone={config.tone}
      data-practical-density={config.density}
      data-checklist-style={config.checklistStyle}
    >
      {assignmentPresent && (
        <div className="callout" data-hue={hue}>
          <span className="t-support t-strong">Tugas praktik</span>
          <p className="t-body">{module.practicalAssignment}</p>
        </div>
      )}
      {hasListContent(module?.checklist) && <ObservationChecklist items={checklistItems} config={config} />}
    </div>
  );
}

/** `practiceAction` (learner player only) closes the practice section, e.g. the "done" check. */
export function LessonStructuredContent({ module, document, withSectionIds = true, practiceAction = null }) {
  const presentation = useMemo(() => lessonPresentation(document || module?.editorialContent), [document, module?.editorialContent]);
  const objectivesArePresent = hasListContent(module?.learningObjectives) || hasListContent(module?.keyTakeaways);
  const practiceIsPresent = hasText(module?.practicalAssignment) || hasListContent(module?.checklist);
  return (
    <>
      {objectivesArePresent && (
        <LessonSection id={withSectionIds ? "objectives" : undefined} title="Tujuan & insight" ic="target" hue="green">
          <LessonObjectivesContent module={module} presentation={presentation} />
        </LessonSection>
      )}
      {practiceIsPresent && (
        <LessonSection id={withSectionIds ? "practical" : undefined} title="Praktik di kandang" ic="egg" hue="teal">
          <LessonPracticalContent module={module} presentation={presentation} />
          {practiceAction}
        </LessonSection>
      )}
    </>
  );
}
