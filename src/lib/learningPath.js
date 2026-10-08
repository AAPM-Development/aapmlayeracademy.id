// Learning path geometry and assessment readouts for the Duolingo-style
// learner flow. Pure functions (no path aliases) so tests can import them.

// One swing of the winding path, as a fraction of the swing width:
// centre → right → centre → left. Each level restarts at the centre.
const PATH_SWING = [0, 0.5, 0.85, 0.5, 0, -0.5, -0.85, -0.5];

/** Horizontal offset (-1…1) of the node at `index` within its level. */
export function pathOffset(index) {
  const position = Math.trunc(Number(index)) || 0;
  const length = PATH_SWING.length;
  return PATH_SWING[((position % length) + length) % length];
}

/**
 * Consecutive correct answers ending at `upTo`. `results` holds true for a
 * checked correct answer, false for a wrong one, undefined when unchecked.
 */
export function correctRun(results = [], upTo = results.length - 1) {
  let run = 0;
  for (let index = Math.min(upTo, results.length - 1); index >= 0; index -= 1) {
    if (results[index] !== true) break;
    run += 1;
  }
  return run;
}

/** "m:ss" for a duration in milliseconds. */
export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
