export function nextChapterNumber(levels = []) {
  const used = new Set(levels.map((level) => Number(level.levelNumber)));
  for (let number = 1; number <= 20; number += 1) {
    if (!used.has(number)) return number;
  }
  return null;
}

export function filterCurriculum(levels = [], query = "") {
  const term = query.trim().toLocaleLowerCase("id-ID");
  if (!term) return levels;
  const numberedQuery = /^(chapter|modul)\s+(\d+)$/.exec(term);
  const matches = (values) => values.some((value) => String(value ?? "").toLocaleLowerCase("id-ID").includes(term));
  return levels.map((level) => ({
    ...level,
    modules: (numberedQuery ? numberedQuery[1] === "chapter" && Number(level.levelNumber) === Number(numberedQuery[2]) : matches([level.levelName, `Chapter ${level.levelNumber}`]))
      ? level.modules
      : (level.modules || []).filter((module) => numberedQuery
        ? numberedQuery[1] === "modul" && Number(module.moduleNumber) === Number(numberedQuery[2])
        : matches([module.title, module.category, module.summary, `Modul ${module.moduleNumber}`])),
  })).filter((level) => level.modules?.length);
}

export function moduleLifecycleLabels(module = {}) {
  const primary = module.lifecycleStatus === "archived"
    ? { label: "Arsip", tone: "neutral" }
    : module.lifecycleStatus === "draft" || !module.publishedRevisionId
      ? { label: "Draf", tone: "warning" }
      : { label: "Terbit", tone: "success" };
  return module.publishedRevisionId && module.draft?.hasUnpublishedChanges
    ? [primary, { label: "Perubahan belum terbit", tone: "warning" }]
    : [primary];
}

export function curriculumStructureRecovery(error, modulePath) {
  if (error?.code !== "curriculum_structure_draft_required") return null;
  return {
    message: error.message,
    to: modulePath || "/admin/curriculum/policies",
    label: modulePath ? "Buka draf modul" : "Kebijakan kurikulum",
  };
}

/** Keep page and retained-dialog feedback aligned with the latest mutation. */
export async function runCurriculumLifecycleMutation(mutate, updateFeedback) {
  updateFeedback(null);
  try {
    const result = await mutate();
    updateFeedback(null);
    return result;
  } catch (error) {
    updateFeedback(error);
    throw error;
  }
}
