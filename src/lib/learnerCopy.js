import { certificationTiers } from "@/lib/academyData";
import { estimateMinutes } from "@/lib/academyVisuals";

export function firstName(user) {
  const name = String(user?.full_name || user?.email || "").trim();
  return name.split(/[\s@]/)[0] || "Peserta";
}

export function greeting(hour = new Date().getHours()) {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 19) return "Selamat sore";
  return "Selamat malam";
}

/** "±12 menit · video · praktik · kuis" */
export function moduleMeta(module, { short = false } = {}) {
  if (!module) return "";
  const parts = [`±${estimateMinutes(module)} ${short ? "mnt" : "menit"}`];
  if (!short) {
    if (module.videoUrl) parts.push("video");
    if (module.practicalAssignment) parts.push("praktik");
    parts.push(module.assessmentMode === "acknowledgement" ? "konfirmasi belajar" : "kuis");
  }
  return parts.join(" · ");
}

/** "3 j 20 m" */
export function formatStudyTime(minutes = 0) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} m`;
  return rest ? `${hours} j ${rest} m` : `${hours} j`;
}

/** The certificate tier a module counts toward, and how many of its modules remain. */
export function tierForModule(moduleNumber, completedSet = new Set()) {
  const tier = certificationTiers.find((item) => item.modules.includes(Number(moduleNumber)));
  if (!tier) return null;
  const remaining = tier.modules.filter((number) => !completedSet.has(number)).length;
  return { ...tier, remaining };
}

/** The first tier the learner does not own yet, with modules left. */
export function nextOpenTier(completedSet = new Set(), certificates = []) {
  const owned = new Set((certificates || []).filter((item) => item?.status !== "revoked").map((item) => Number(item.levelNumber ?? item.tierNumber)));
  const tier = certificationTiers.find((item) => !owned.has(item.number));
  if (!tier) return null;
  return { ...tier, remaining: tier.modules.filter((number) => !completedSet.has(number)).length };
}
