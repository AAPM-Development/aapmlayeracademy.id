import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nativeApi } from '@/api/nativeClient';

// Fetch all course modules
export function useModules() {
  return useQuery({
    queryKey: ['courseModules'],
    queryFn: () => nativeApi.courseModules.list(),
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

// Fetch user progress for current user
export function useUserProgress() {
  return useQuery({
    queryKey: ['userProgress'],
    queryFn: () => nativeApi.userProgress.list(),
  });
}

// Upsert progress for a module
export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleNumber, data }) => nativeApi.userProgress.upsert(moduleNumber, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userProgress'] });
    },
  });
}

// Fetch certificates
export function useCertificates() {
  return useQuery({
    queryKey: ['certificates'],
    queryFn: () => nativeApi.certificates.list(),
  });
}

// Issue certificate
export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.certificates.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
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
