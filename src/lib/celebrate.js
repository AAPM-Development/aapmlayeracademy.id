// Completion moments (quiz passed, module done, a run of right answers): short
// confetti bursts in the learning hues. Decoration only: skipped when the
// learner asked for reduced motion, loaded on demand, and never blocks or
// breaks the flow.
const CELEBRATION_HUES = ["green", "orange", "blue", "violet", "amber"];

function reducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function hueColors() {
  const styles = window.getComputedStyle(document.documentElement);
  return CELEBRATION_HUES
    .map((hue) => styles.getPropertyValue(`--aapm-semantic-hue-${hue}`).trim())
    .filter((value) => /^#[0-9a-f]{6}$/i.test(value));
}

/** Viewport origin (0–1) of an element's centre, for bursts that start at a control. */
export function originOf(element) {
  if (!element?.getBoundingClientRect) return undefined;
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

/**
 * `burst` (default): one burst for a passed quiz or a finished module.
 * `milestone`: side cannons and stars for a perfect score, a certificate or a
 * published curriculum. `streak`: a small spark at `origin` for a run of right
 * answers.
 */
/** @param {string} [kind] @param {{ origin?: { x: number, y: number } }} [options] */
export async function celebrate(kind = "burst", { origin } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    if (reducedMotion()) return;
    const colors = hueColors();
    const base = { colors: colors.length ? colors : undefined, disableForReducedMotion: true, zIndex: 2000 };

    if (kind === "streak") {
      confetti({ ...base, particleCount: 26, spread: 56, startVelocity: 26, ticks: 90, scalar: .8, gravity: 1.1, origin: origin || { x: .85, y: .9 } });
      return;
    }

    if (kind === "milestone") {
      const sides = [{ x: 0, angle: 60 }, { x: 1, angle: 120 }];
      sides.forEach(({ x, angle }) => confetti({ ...base, particleCount: 70, angle, spread: 62, startVelocity: 52, ticks: 220, origin: { x, y: .78 } }));
      window.setTimeout(() => {
        confetti({ ...base, particleCount: 48, spread: 100, startVelocity: 30, ticks: 200, scalar: 1.15, shapes: ["star"], origin: origin || { x: .5, y: .45 } });
      }, 260);
      return;
    }

    confetti({
      ...base,
      particleCount: 90,
      spread: 72,
      startVelocity: 36,
      ticks: 160,
      origin: origin || { y: 0.72 },
    });
  } catch {
    // Decoration only.
  }
}
