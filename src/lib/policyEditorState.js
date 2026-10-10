export function policyPayload(policy) {
  return {
    modules: policy.modules.map(({ moduleNumber, required, assessmentMode }) => ({ moduleNumber, required, assessmentMode })),
    tiers: policy.tiers.map(({ tierNumber, tierName, modules, requiresFinal }) => ({ tierNumber, tierName, modules: [...modules], requiresFinal })),
    modulePassPercent: policy.modulePassPercent,
    finalPassPercent: policy.finalPassPercent,
  };
}

export function movePolicyModule(modules, index, delta) {
  const next = [...modules];
  if (index + delta < 0 || index + delta >= next.length) return next;
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

export const nextPolicyVersion = (policies) => `academy-v${Math.max(1, ...policies.map(({ version }) => Number(version.split('-v')[1]) || 1)) + 1}`;

export function draftFailure(error) {
  return error?.code === 'revision_conflict'
    ? 'Draf telah berubah di sesi lain. Isian Anda tetap tersimpan di layar. Salin perubahan Anda sebelum memuat ulang draf terbaru.'
    : error?.message || 'Perubahan belum tersimpan. Coba lagi.';
}

export function curriculumPrimaryAction({ dirty, valid, ready = false }) {
  if (dirty) return 'save';
  if (ready) return null;
  return valid ? 'publish' : 'validate';
}
