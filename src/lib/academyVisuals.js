import { hueFor } from "@/design-system/components/display";
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

export function levelVisual(levelNumber) {
  const number = Number(levelNumber) || 1;
  return { hue: hueFor(number), icon: levelIcons[number] || "modules" };
}

export function moduleVisual(module) {
  return levelVisual(module?.level);
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
    if (!byLevel.has(level)) {
      const meta = levelMeta(level);
      byLevel.set(level, {
        number: level,
        name: module.levelName || meta?.name || `Level ${level}`,
        description: meta?.description || "",
        ...levelVisual(level),
        modules: [],
      });
    }
    byLevel.get(level).modules.push({
      ...module,
      state: getModuleState(module, sorted, completedSet),
      progress: progress.find((item) => Number(item.moduleNumber) === Number(module.moduleNumber)) || null,
    });
  });

  return [...byLevel.values()].map((level) => {
    const completed = level.modules.filter((module) => module.state === "completed").length;
    return {
      ...level,
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
    quizAttempted: quizTotal > 0,
    quizPercent,
    quizPassed: quizPercent !== null && quizPercent >= 70,
    hasQuiz: quizCount > 0,
    hasPractice: Boolean(hasPractice),
    moduleNumber: module?.moduleNumber,
  };
}
