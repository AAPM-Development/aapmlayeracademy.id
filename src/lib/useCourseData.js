import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Fetch all course modules
export function useModules() {
  return useQuery({
    queryKey: ['courseModules'],
    queryFn: async () => {
      const res = await base44.entities.CourseModule.list('moduleNumber', 100);
      return res.items || res || [];
    },
  });
}

// Fetch quiz questions for a module (moduleNumber 0 = final exam)
export function useQuizQuestions(moduleNumber) {
  return useQuery({
    queryKey: ['quizQuestions', moduleNumber],
    queryFn: async () => {
      const res = await base44.entities.QuizQuestion.filter({ moduleNumber }, undefined, 100);
      return res.items || res || [];
    },
    enabled: moduleNumber !== undefined && moduleNumber !== null,
  });
}

// Fetch user progress for current user
export function useUserProgress() {
  return useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      const res = await base44.entities.UserProgress.list('moduleNumber', 100);
      return res.items || res || [];
    },
  });
}

// Upsert progress for a module
export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moduleNumber, data }) => {
      const existing = await base44.entities.UserProgress.filter({ moduleNumber }, undefined, 10);
      const list = existing.items || existing || [];
      if (list.length > 0) {
        return await base44.entities.UserProgress.update(list[0].id, data);
      }
      return await base44.entities.UserProgress.create({ moduleNumber, ...data });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userProgress'] });
    },
  });
}

// Fetch certificates
export function useCertificates() {
  return useQuery({
    queryKey: ['certificates'],
    queryFn: async () => {
      const res = await base44.entities.Certificate.list('levelNumber', 50);
      return res.items || res || [];
    },
  });
}

// Issue certificate
export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Certificate.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}

// Farm data (KPI dashboard)
export function useFarmData() {
  return useQuery({
    queryKey: ['farmData'],
    queryFn: async () => {
      const res = await base44.entities.FarmData.list('week', 200);
      return res.items || res || [];
    },
  });
}

export function useSaveFarmData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) return await base44.entities.FarmData.update(id, data);
      return await base44.entities.FarmData.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farmData'] });
    },
  });
}

export function useDeleteFarmData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      return await base44.entities.FarmData.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farmData'] });
    },
  });
}

// AI assistant
export function useAiAssistant() {
  return useMutation({
    mutationFn: async ({ message, farmContext }) => {
      const res = await base44.functions.invoke('aiFarmAssistant', { message, farmContext });
      return res.data;
    },
  });
}