// Completion moments (quiz passed, module done): one short confetti burst in
// the learning hues. Decoration only: skipped when the learner asked for
// reduced motion, loaded on demand, and never blocks or breaks the flow.
const CELEBRATION_HUES = ["green", "orange", "blue", "violet", "amber"];

export async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    const styles = window.getComputedStyle(document.documentElement);
    const colors = CELEBRATION_HUES
      .map((hue) => styles.getPropertyValue(`--aapm-semantic-hue-${hue}`).trim())
      .filter((value) => /^#[0-9a-f]{6}$/i.test(value));
    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 36,
      ticks: 160,
      origin: { y: 0.72 },
      colors: colors.length ? colors : undefined,
      disableForReducedMotion: true,
    });
  } catch {
    // Decoration only.
  }
}
