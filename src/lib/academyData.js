export const TOTAL_MODULES = 22;
export const TOTAL_LEARNING_LEVELS = 14;
export const TOTAL_CERTIFICATION_TIERS = 6;

export const learningLevels = [
  { number: 1, name: "Foundation", description: "Peta sistem dan operasi layer farm." },
  { number: 2, name: "Brooding & Rearing", description: "Membangun flock yang seragam sejak awal." },
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

export const certificationTiers = [
  { number: 1, name: "Layer Poultry Farm Foundation", modules: [1, 2, 3] },
  { number: 2, name: "Layer Farm Operator", modules: [4, 5] },
  { number: 3, name: "Layer Farm Supervisor", modules: [6, 7, 8, 11, 12, 13, 15, 16, 17] },
  { number: 4, name: "Layer Farm Manager", modules: [9, 10, 14, 18] },
  { number: 5, name: "Advanced Layer Farm Management", modules: [19, 20, 21] },
  { number: 6, name: "Layer Poultry Farm Expert", modules: [22], requiresFinal: true },
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
  return Number(firstIncomplete?.moduleNumber) === Number(module.moduleNumber) ? "current" : "locked";
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
