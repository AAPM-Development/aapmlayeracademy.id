import { hueFor } from "@/design-system/components/display";
import { safeEditorialImage } from "@/lib/editorialUrls";
import { normaliseModuleVisual } from "@/lib/moduleVisual";
import { getCompletedModuleSet, getModuleState, learningLevels, sortModules } from "@/lib/academyData";

// Visual identity per learning level: a hue (from the AAPM learning palette)
// and a Solar/AAPM icon that names the topic. Presentation only.
const levelIcons = {
  1: "book",
  2: "hen",
  3: "egg",
  4: "feed",
  5: "waterRate",
  6: "hvac",
  7: "medical",
  8: "shield",
  9: "egg",
  10: "kpi",
  11: "finance",
  12: "workspace",
  13: "insight",
  14: "graduation",
};

// Canvas icon (`.ic-*`) per level, as drawn on the Redesign v2 path.
const levelCanvasIcons = {
  1: "book", 2: "thermo", 3: "egg", 4: "feed", 5: "drop", 6: "wind", 7: "heart",
  8: "shield", 9: "egg", 10: "chart", 11: "wallet", 12: "layers", 13: "bulb", 14: "grad",
};

export function levelVisual(levelNumber) {
  const number = Number(levelNumber) || 1;
  // Same shape as moduleVisual(): a chapter has no custom icon or banner.
  return { hue: hueFor(number), icon: levelIcons[number] || "modules", ic: levelCanvasIcons[number] || "book", customIcon: false, image: "", focus: "center" };
}

export function moduleVisual(module) {
  const base = levelVisual(module?.level ?? module?.levelNumber);
  const own = normaliseModuleVisual(module?.visual);
  return {
    ...base,
    hue: own.hue !== "auto" ? own.hue : base.hue,
    ic: own.icon !== "auto" ? own.icon : base.ic,
    customIcon: own.icon !== "auto",
    image: safeEditorialImage(own.image) || "",
    focus: own.focus,
  };
}

export function levelMeta(levelNumber) {
  return learningLevels.find((level) => level.number === Number(levelNumber)) || null;
}

/** Group modules by level with progress and state for path/outline views. */
export function buildCurriculum(modules = [], progress = []) {
  const sorted = sortModules(modules);
  const completedSet = getCompletedModuleSet(progress, sorted);
  const byLevel = new Map();

  sorted.forEach((module) => {
    const level = Number(module.level) || 1;
    // Chapter numbers repeat across curricula, so a chapter is curriculum + number.
    const key = `${module.curriculumId || ""}:${level}`;
    if (!byLevel.has(key)) {
      const meta = levelMeta(level);
      byLevel.set(key, {
        key,
        curriculumId: module.curriculumId || "",
        curriculumTitle: module.curriculumTitle || "",
        number: level,
        name: module.levelName || meta?.name || `Chapter ${level}`,
        description: meta?.description || "",
        ...levelVisual(level),
        modules: [],
      });
    }
    byLevel.get(key).modules.push({
      ...module,
      state: getModuleState(module, sorted, completedSet),
      progress: progress.find((item) => Number(item.moduleNumber) === Number(module.moduleNumber)) || null,
    });
  });

  const groups = [...byLevel.values()];
  const firstCurriculum = groups[0]?.curriculumId;
  const multiple = groups.some((level) => level.curriculumId !== firstCurriculum);
  return groups.map((level, index) => {
    const completed = level.modules.filter((module) => module.state === "completed").length;
    const own = level.curriculumId === firstCurriculum;
    return {
      ...level,
      // The first curriculum keeps the old #level-N anchors; others get their own.
      anchor: own ? `level-${level.number}` : `level-${level.curriculumId}-${level.number}`,
      // When the catalogue spans curricula, the first chapter of each opens its section.
      curriculumStart: multiple && (index === 0 || groups[index - 1].curriculumId !== level.curriculumId),
      completed,
      total: level.modules.length,
      percent: level.modules.length ? Math.round((completed / level.modules.length) * 100) : 0,
      hasCurrent: level.modules.some((module) => module.state === "current"),
    };
  });
}

/** Rough reading time from module text, for "≈ 12 menit" style metadata. */
export function estimateMinutes(module) {
  const text = [module?.content, module?.summary, module?.practicalAssignment, ...(module?.learningObjectives || []), ...(module?.keyTakeaways || [])]
    .filter((value) => typeof value === "string")
    .join(" ");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const reading = Math.ceil(words / 180);
  const video = module?.videoUrl ? 6 : 0;
  return Math.max(5, reading + video);
}

/** Module flow state for the bounded flow stepper. */
export function moduleFlowState({ module, progress, hasPractice, quizCount = 0 }) {
  const quizTotal = Number(progress?.quizTotal) || 0;
  const quizScore = Number(progress?.quizScore) || 0;
  const quizPercent = quizTotal ? Math.round((quizScore / quizTotal) * 100) : null;
  const completed = Boolean(progress?.completed);
  return {
    completed,
    acknowledged: Boolean(progress?.acknowledged),
    quizAttempted: Boolean(progress?.quizAttempted) || quizTotal > 0,
    quizPercent,
    activeAttempt: Boolean(progress?.activeAttempt),
    quizPassed: Boolean(progress?.quizPassed),
    practicalDone: Boolean(progress?.practicalDone),
    hasQuiz: module?.assessmentMode ? module.assessmentMode === "quiz" : typeof progress?.hasQuiz === "boolean" ? progress.hasQuiz : quizCount > 0,
    hasPractice: Boolean(hasPractice),
    moduleNumber: module?.moduleNumber,
  };
}
