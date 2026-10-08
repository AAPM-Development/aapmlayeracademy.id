/** Keep edits made after the request started, while adopting server-normalized fields. */
export function reconcileSavedModule(submitted, current, saved) {
  return Object.fromEntries(Object.keys(saved).map((key) => [
    key,
    JSON.stringify(current[key]) !== JSON.stringify(submitted[key]) ? current[key] : saved[key],
  ]));
}
