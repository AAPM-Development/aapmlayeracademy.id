/** Normalize both the admin view and immutable revision payload for editor/preview use. */
export function curriculumModule(view) {
  const module = view?.module || view || {};
  const payload = module.draftPayload || view?.payload;
  if (!payload) return module;
  const list = (value) => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  };
  let editorialContent = payload.editorialContent;
  if (typeof editorialContent === "string") {
    try { editorialContent = JSON.parse(editorialContent); } catch { editorialContent = null; }
  }
  return { ...module, ...payload, level: payload.levelNumber, order: payload.sortOrder,
    editorialContent, learningObjectives: list(payload.learningObjectives),
    keyTakeaways: list(payload.keyTakeaways), checklist: list(payload.checklist) };
}

/** Conflict recovery is explicit: keep the entire form or replace it; never merge remote fields. */
export function recoverCurriculumDraft(currentForm, latestForm, latestVersion, keepChanges) {
  return { form: keepChanges ? currentForm : latestForm, draftVersion: latestVersion };
}

export function canPublishCurriculumDraft({ validation, review, draftVersion, dirty, conflict, archived }) {
  return Boolean(!dirty && !conflict && !archived && validation?.valid && review?.valid &&
    validation.draftVersion === draftVersion && review.draftVersion === draftVersion);
}
