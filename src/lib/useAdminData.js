import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => nativeApi.admin.overview(),
  });
}

export function useAdminCourses() {
  return useQuery({
    queryKey: ["admin", "courses"],
    queryFn: () => nativeApi.admin.courses.list(),
  });
}

export function useAdminCourse(courseId) {
  return useQuery({
    queryKey: ["admin", "courses", courseId],
    queryFn: () => nativeApi.admin.courses.detail(courseId),
    enabled: Boolean(courseId),
  });
}

export function useAdminLearners(search = "") {
  return useQuery({
    queryKey: ["admin", "learners", search],
    queryFn: () => nativeApi.admin.learners.list(search),
  });
}

export function useAdminLearner(learnerId) {
  return useQuery({
    queryKey: ["admin", "learners", learnerId],
    queryFn: () => nativeApi.admin.learners.detail(learnerId),
    enabled: Boolean(learnerId),
  });
}

export function useAdminUsers(search = "") {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => nativeApi.admin.users.list(search),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.admin.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "learners"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }) => nativeApi.admin.users.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "learners"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export function useResetAdminUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }) =>
      nativeApi.admin.users.resetPassword(userId, password),
  });
}

export function useAdminModule(moduleId) {
  return useQuery({
    queryKey: ["admin", "modules", moduleId],
    queryFn: () => nativeApi.admin.modules.detail(moduleId),
    enabled: Boolean(moduleId),
  });
}

export function useAdminModuleQuestions(moduleId) {
  return useQuery({
    queryKey: ["admin", "modules", moduleId, "questions"],
    queryFn: () => nativeApi.admin.modules.questions(moduleId),
    enabled: Boolean(moduleId),
  });
}

function invalidateCourseData(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
  queryClient.invalidateQueries({ queryKey: ["courseModules"] });
  queryClient.invalidateQueries({ queryKey: ["quizQuestions"] });
}

export function useCreateAdminModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.admin.modules.create(data),
    onSuccess: () => invalidateCourseData(queryClient),
  });
}

export function useUpdateAdminModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, data }) => nativeApi.admin.modules.update(moduleId, data),
    onSuccess: (_, variables) => {
      invalidateCourseData(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin", "modules", variables.moduleId] });
    },
  });
}

export function useDeleteAdminModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleId) => nativeApi.admin.modules.delete(moduleId),
    onSuccess: () => invalidateCourseData(queryClient),
  });
}

export function useReorderAdminModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => nativeApi.admin.modules.reorder(items),
    onSuccess: () => invalidateCourseData(queryClient),
  });
}

export function useSaveAdminQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, questionId, data }) =>
      questionId
        ? nativeApi.admin.modules.updateQuestion(moduleId, questionId, data)
        : nativeApi.admin.modules.createQuestion(moduleId, data),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "modules", variables.moduleId, "questions"],
      }),
  });
}

export function useDeleteAdminQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, questionId }) =>
      nativeApi.admin.modules.deleteQuestion(moduleId, questionId),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "modules", variables.moduleId, "questions"],
      }),
  });
}

export function useAdminAiSettings() {
  return useQuery({
    queryKey: ["admin", "ai-settings"],
    queryFn: () => nativeApi.admin.aiSettings.get(),
  });
}

export function useSaveAdminAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.admin.aiSettings.update(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "ai-settings"] }),
  });
}

export function useTestAdminAiSettings() {
  return useMutation({
    mutationFn: (data) => nativeApi.admin.aiSettings.test(data),
  });
}

export function useDiscoverAdminAiModels() {
  return useMutation({
    mutationFn: (data) => nativeApi.admin.aiSettings.discoverModels(data),
  });
}
