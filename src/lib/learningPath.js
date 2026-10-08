// Assessment readouts for the learner flow (quiz runs and durations).
// Pure functions (no path aliases) so tests can import them.

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
