import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nativeApi, newRequestKey } from '@/api/nativeClient';

// Fetch all course modules
export function useModules() {
  return useQuery({
    queryKey: ['courseModules'],
    queryFn: () => nativeApi.courseModules.list(),
    // The learner route is the public projection of admin edits. Always
    // re-read it when the route mounts so a cached catalog can never mask a
    // just-saved, added, or deleted module.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

// Fetch quiz questions for a module (moduleNumber 0 = final exam)
export function useQuizQuestions(moduleNumber) {
  return useQuery({
    queryKey: ['quizQuestions', moduleNumber],
    queryFn: () => nativeApi.quizQuestions.list(moduleNumber),
    enabled: moduleNumber !== undefined && moduleNumber !== null,
  });
}

// Fetch user progress for current user (server-derived)
export function useUserProgress() {
  return useQuery({
    queryKey: ['userProgress'],
    queryFn: () => nativeApi.userProgress.list(),
  });
}

// Final-exam gate and status (server-derived)
export function useFinalEligibility() {
  return useQuery({
    queryKey: ['finalEligibility'],
    queryFn: () => nativeApi.assessments.finalEligibility(),
  });
}

function refreshAcademic(qc) {
  qc.invalidateQueries({ queryKey: ['userProgress'] });
  qc.invalidateQueries({ queryKey: ['finalEligibility'] });
}

// Start or resume an assessment attempt. The server returns the questions
// without answer keys; a repeated start resumes the active attempt.
export function useStartAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { assessmentType, moduleNumber }) =>
      nativeApi.assessments.start({ assessmentType, moduleNumber, requestKey: newRequestKey() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finalEligibility'] }),
  });
}

// Save one answer. Module answers are checked by the server and return feedback.
export function useAnswerAssessment() {
  return useMutation({
    mutationFn: (/** @type {any} */ { attemptId, questionId, answerIndex }) =>
      nativeApi.assessments.answer(attemptId, { questionId, answerIndex }),
  });
}

// Submit an attempt. The server grades it and records the academic outcome.
export function useSubmitAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { attemptId }) => nativeApi.assessments.submit(attemptId, { requestKey: newRequestKey() }),
    onSuccess: () => refreshAcademic(qc),
  });
}

// Record that the learner worked through a module without a quiz.
export function useAcknowledgeModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ moduleNumber) => nativeApi.learning.acknowledge(moduleNumber),
    onSuccess: () => refreshAcademic(qc),
  });
}

// Self-attested practice. Attestation never changes academic completion.
export function usePracticeAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { moduleNumber, attested }) =>
      nativeApi.learning.practice(moduleNumber, { attested, requestKey: newRequestKey() }),
    onSuccess: () => refreshAcademic(qc),
  });
}

// One study-time increment, at most 15 minutes, with its own key.
export function useStudyTimeIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { moduleNumber, minutes }) =>
      nativeApi.learning.studyTime(moduleNumber, { minutes, requestKey: newRequestKey() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userProgress'] }),
  });
}

// Fetch certificates
export function useCertificates() {
  return useQuery({
    queryKey: ['certificates'],
    queryFn: () => nativeApi.certificates.list(),
  });
}

// Farm data (KPI dashboard)
export function useFarmData() {
  return useQuery({
    queryKey: ['farmData'],
    queryFn: () => nativeApi.farmData.list(),
  });
}

export function useSaveFarmData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => id ? nativeApi.farmData.update(id, data) : nativeApi.farmData.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farmData'] });
    },
  });
}

export function useDeleteFarmData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => nativeApi.farmData.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farmData'] });
    },
  });
}

// AI assistant
export function useAiAssistant() {
  return useMutation({
    mutationFn: ({ message, farmContext }) => nativeApi.ai.assistant({ message, farmContext }),
  });
}

// Certification eligibility for all six tiers (server-derived)
export function useCertificationEligibility() {
  return useQuery({
    queryKey: ['certificationEligibility'],
    queryFn: () => nativeApi.certificates.eligibility(),
  });
}

// Claim one tier. Success is shown only after the server confirms issuance; a lost
// response is recovered by re-reading eligibility and certificates, never by re-claiming blindly.
export function useClaimCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { tierNumber, requestKey }) => nativeApi.certificates.claim(tierNumber, requestKey),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['certificationEligibility'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
