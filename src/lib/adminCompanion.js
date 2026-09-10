import { aiEditorialMaterialSource, normaliseAiEditorialMaterial } from "@/lib/aiEditorialRewrite";

const MAX_LIST_ITEMS = 6;

const listValue = (value) => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|•/) : [];
  return values
    .map((item) => String(item || "").replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
};

export function companionModuleContext(module = {}) {
  return {
    id: module.id ?? null,
    moduleNumber: module.moduleNumber ?? "",
    levelNumber: module.levelNumber ?? "",
    levelName: module.levelName ?? "",
    title: String(module.title || "").slice(0, 180),
    category: String(module.category || "").slice(0, 120),
    summary: String(module.summary || "").slice(0, 600),
    content: String(module.content || "").slice(0, 8000),
    editorialContent: module.editorialContent ?? null,
    videoScript: String(module.videoScript || "").slice(0, 1200),
    learningObjectives: listValue(module.learningObjectives),
    keyTakeaways: listValue(module.keyTakeaways),
    checklist: listValue(module.checklist),
    practicalAssignment: String(module.practicalAssignment || "").slice(0, 1200),
    order: module.order ?? "",
  };
}

export function companionCourseModules(modules = []) {
  return (Array.isArray(modules) ? modules : [])
    .map((module) => ({
      id: module.id ?? null,
      moduleNumber: module.moduleNumber ?? "",
      levelNumber: module.levelNumber ?? "",
      levelName: module.levelName ?? "",
      title: String(module.title || "").slice(0, 180),
      category: String(module.category || "").slice(0, 120),
      summary: String(module.summary || "").slice(0, 300),
      order: module.order ?? module.moduleNumber ?? "",
    }))
    .filter((module) => module.id !== null && module.id !== undefined);
}

export function companionModuleDraftPayload(payload = {}, materialSource = []) {
  if (!payload || typeof payload !== "object") return null;
  const has = (field) => Object.prototype.hasOwnProperty.call(payload, field);
  const draft = {
    title: typeof payload.title === "string" ? payload.title.trim().slice(0, 180) : "",
    summary: typeof payload.summary === "string" ? payload.summary.trim().slice(0, 600) : "",
    learningObjectives: listValue(payload.learningObjectives),
    keyTakeaways: listValue(payload.keyTakeaways),
    checklist: listValue(payload.checklist),
    practicalAssignment: typeof payload.practicalAssignment === "string" ? payload.practicalAssignment.trim().slice(0, 1200) : "",
    materialBlocks: normaliseAiEditorialMaterial(payload.materialBlocks, materialSource),
    fieldPresence: {
      title: has("title"),
      summary: has("summary"),
      learningObjectives: has("learningObjectives"),
      keyTakeaways: has("keyTakeaways"),
      checklist: has("checklist"),
      practicalAssignment: has("practicalAssignment"),
    },
  };
  return draft.title || draft.summary || draft.learningObjectives.length || draft.keyTakeaways.length || draft.checklist.length || draft.practicalAssignment || draft.materialBlocks.length
    ? draft
    : null;
}

export function companionOrderPayload(payload = {}, modules = []) {
  const ids = Array.isArray(payload?.moduleIds) ? payload.moduleIds.map((id) => String(id)) : [];
  const expected = companionCourseModules(modules).map((module) => String(module.id));
  if (!ids.length || ids.length !== expected.length) return null;
  const expectedSet = new Set(expected);
  const unique = new Set(ids);
  if (unique.size !== expectedSet.size || ids.some((id) => !expectedSet.has(id))) return null;
  return ids;
}

export function companionMaterialSource(module = {}) {
  return aiEditorialMaterialSource(module.editorialContent, module.content);
}

