/**
 * The number people see: the module's position in its curriculum, so it has no
 * gaps and follows the order. `moduleNumber` stays the stable id used by links,
 * progress, attempts, and certificates.
 */
export function moduleNo(module) {
  return module?.displayNumber ?? module?.moduleNumber;
}
