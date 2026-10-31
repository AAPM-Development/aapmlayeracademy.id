export const TOTAL_MODULES = 23;
export const TOTAL_LEARNING_LEVELS = 14;
export const TOTAL_CERTIFICATION_TIERS = 6;

export const learningLevels = [
  { number: 1, name: "Foundation", description: "Cara bisnis layer menghasilkan uang dan memilih bibit." },
  { number: 2, name: "Pondasi", description: "Menyiapkan kandang dan pullet yang seragam." },
  { number: 3, name: "Layer Management", description: "Mengawal transisi dan produksi." },
  { number: 4, name: "Nutrition", description: "Menghubungkan pakan dengan output." },
  { number: 5, name: "Water Management", description: "Menjaga akses dan kualitas air." },
  { number: 6, name: "Environment & Closed House", description: "Mengatur mikroklimat dan ventilasi." },
  { number: 7, name: "Health & Veterinary", description: "Mendeteksi dan mengeskalasi risiko kesehatan." },
  { number: 8, name: "Biosecurity", description: "Membangun lapisan pencegahan penyakit." },
  { number: 9, name: "Egg Management", description: "Menjaga kualitas dari nest sampai grading." },
  { number: 10, name: "Farm Data & KPI", description: "Membaca performa dengan data yang konsisten." },
  { number: 11, name: "Farm Economics", description: "Mengelola margin, biaya, dan cashflow." },
  { number: 12, name: "Farm Management", description: "Menerjemahkan SOP menjadi ritme kerja." },
  { number: 13, name: "Advanced Management", description: "Memecahkan gap dengan root cause analysis." },
  { number: 14, name: "Expert Level", description: "Mengambil keputusan dan memimpin perbaikan." },
];

// Tiers of the academy-v2 policy (curriculum v2.0). Learners on v1 get the same
// names from their own policy row; this table is the public catalogue.
export const certificationTiers = [
  { number: 1, name: "Layer Poultry Farm Foundation", modules: [1, 2, 3] },
  { number: 2, name: "Layer Farm Operator", modules: [4, 5, 6, 7] },
  { number: 3, name: "Layer Farm Supervisor", modules: [8, 9, 10, 11, 12, 13, 14] },
  { number: 4, name: "Layer Farm Manager", modules: [15, 16, 17, 18, 19] },
  { number: 5, name: "Advanced Layer Farm Management", modules: [20, 21] },
  { number: 6, name: "Layer Poultry Farm Expert", modules: [22, 23], requiresFinal: true },
];

export function sortModules(modules = []) {
  return [...modules].sort((a, b) => (a.moduleNumber || 0) - (b.moduleNumber || 0));
}

export function getCompletedModuleSet(progress = [], modules = null) {
  const activeModuleNumbers = Array.isArray(modules)
    ? new Set(modules.map((module) => Number(module?.moduleNumber)).filter((number) => number > 0))
    : null;

  return new Set(
    progress
      .filter((item) => {
        const moduleNumber = Number(item?.moduleNumber);
        return Boolean(item?.completed) && moduleNumber > 0 && (
          activeModuleNumbers === null || activeModuleNumbers.has(moduleNumber)
        );
      })
      .map((item) => Number(item.moduleNumber)),
  );
}

export function getProgressSummary(modules = [], progress = [], fallbackTotal = 0) {
  const sorted = sortModules(modules);
  const completedSet = getCompletedModuleSet(progress, sorted);
  const total = sorted.length || fallbackTotal;
  const completed = sorted.length
    ? sorted.filter((module) => completedSet.has(Number(module.moduleNumber))).length
    : completedSet.size;

  return {
    completed,
    total,
    percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    completedSet,
  };
}

export function getNextModule(modules = [], progress = []) {
  const completedSet = getCompletedModuleSet(progress, modules);
  return sortModules(modules).find((module) => !completedSet.has(Number(module.moduleNumber))) || null;
}

export function getModuleState(module, modules = [], completedSet = new Set()) {
  if (!module) return "locked";
  if (completedSet.has(Number(module.moduleNumber))) return "completed";
  if (module.available === true || module.state === "available") return "available";

  const firstIncomplete = sortModules(modules).find((item) => !completedSet.has(Number(item.moduleNumber)));
  return Number(firstIncomplete?.moduleNumber) === Number(module.moduleNumber) ? "current" : "available";
}

export function getLevelProgress(levelNumber, modules = [], completedSet = new Set()) {
  const levelModules = sortModules(modules).filter((module) => module.level === levelNumber);
  const completed = levelModules.filter((module) => completedSet.has(Number(module.moduleNumber))).length;

  return {
    total: levelModules.length,
    completed,
    percent: levelModules.length ? Math.round((completed / levelModules.length) * 100) : 0,
  };
}

export function getCertificationState(tier, completedSet = new Set(), finalPassed = false, certificates = []) {
  const completed = tier.modules.filter((moduleNumber) => completedSet.has(moduleNumber)).length;
  const owned = certificates.some((certificate) => certificate.levelNumber === tier.number);
  const modulesComplete = completed === tier.modules.length;
  const eligible = modulesComplete && (!tier.requiresFinal || finalPassed);

  return {
    completed,
    owned,
    eligible,
    status: owned ? "completed" : eligible ? "eligible" : completed > 0 ? "in-progress" : "locked",
  };
}

// Learner ranks, mirroring profile_learning_summary() in the API: points come
// from completed modules (100), practice (35), certificates (150), quiz
// average, farm entries and study time.
export const learnerRanks = [
  { name: "Foundation", from: 0 },
  { name: "Field Builder", from: 400 },
  { name: "Farm Analyst", from: 1500 },
  { name: "Layer Leader", from: 2700 },
];

/** Rank, its point window and the distance to the next rank. */
export function getRankProgress(points = 0) {
  const value = Math.max(0, Number(points) || 0);
  const index = learnerRanks.reduce((found, rank, position) => (value >= rank.from ? position : found), 0);
  const rank = learnerRanks[index];
  const next = learnerRanks[index + 1] || null;
  const percent = next ? Math.round(((value - rank.from) / (next.from - rank.from)) * 100) : 100;
  return { name: rank.name, points: value, from: rank.from, to: next?.from ?? null, nextName: next?.name ?? null, toNext: next ? next.from - value : 0, percent: Math.max(0, Math.min(100, percent)) };
}

/** Chapters for lists and filters: a name saved on the modules wins over the fallback. */
export function chapterOptions(modules = []) {
  return learningLevels.map((level) => {
    const own = modules.find((module) => Number(module?.level) === level.number && module?.levelName);
    return own ? { ...level, name: own.levelName } : level;
  });
}

/** The chapter (number, name) a module belongs to. */
export function getLevelForModule(module) {
  if (!module) return null;
  const level = learningLevels.find((item) => item.number === Number(module.level));
  if (!level) return null;
  return module.levelName ? { ...level, name: module.levelName } : level;
}
