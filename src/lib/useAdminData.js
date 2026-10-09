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

export function useResetAdminUserProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }) => nativeApi.admin.users.resetProgress(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "learners"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      // If an admin resets the account currently open in another view, keep
      // the learner-facing projections in the same SPA session consistent.
      queryClient.invalidateQueries({ queryKey: ["userProgress"] });
      queryClient.invalidateQueries({ queryKey: ["learning-profile"] });
    },
  });
}

export function useAdminModule(moduleId) {
  return useQuery({
    queryKey: ["admin", "modules", moduleId],
    queryFn: () => nativeApi.admin.modules.detail(moduleId, "draft"),
    refetchOnWindowFocus: false,
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
  queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "learners"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
  // Refresh inactive learner projections too. This matters when an admin
  // saves in one route and the learner view is opened from the same SPA
  // session afterwards.
  queryClient.invalidateQueries({ queryKey: ["courseModules"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["userProgress"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["learning-profile"], refetchType: "all" });
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
    mutationFn: (/** @type {{moduleId: string | number, data: any, expectedDraftVersion: number}} */ { moduleId, data, expectedDraftVersion }) => nativeApi.admin.modules.saveDraft(moduleId, data, expectedDraftVersion),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(["admin", "modules", variables.moduleId], result);
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });
}

export function useDeleteAdminModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, purgeProgress = false }) =>
      nativeApi.admin.modules.delete(moduleId, { purgeProgress }),
    onSuccess: () => invalidateCourseData(queryClient),
  });
}

export function useReorderAdminModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => nativeApi.admin.modules.reorder(items),
    onSuccess: (result) => {
      if (result?.course?.id) queryClient.setQueryData(["admin", "courses", result.course.id], result.course);
      invalidateCourseData(queryClient);
    },
  });
}

export function useRenameAdminChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ levelNumber, levelName }) => nativeApi.admin.modules.renameChapter(levelNumber, levelName),
    onSuccess: () => invalidateCourseData(queryClient),
  });
}

export function useSaveAdminQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{moduleId: string | number, questionId?: number, data: any, expectedDraftVersion: number}} */ { moduleId, questionId, data, expectedDraftVersion }) =>
      questionId
        ? nativeApi.admin.modules.updateQuestion(moduleId, questionId, data, expectedDraftVersion)
        : nativeApi.admin.modules.createQuestion(moduleId, data, expectedDraftVersion),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "modules", variables.moduleId, "questions"],
      }),
  });
}

export function useDeleteAdminQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{moduleId: string | number, questionId: number, expectedDraftVersion: number}} */ { moduleId, questionId, expectedDraftVersion }) =>
      nativeApi.admin.modules.deleteQuestion(moduleId, questionId, expectedDraftVersion),
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

export function useAdminCertificates(filters = {}) {
  return useQuery({
    queryKey: ["admin", "certificates", filters],
    queryFn: () => nativeApi.admin.certificates.list(filters),
  });
}

export function useAdminCertificate(publicId) {
  return useQuery({
    queryKey: ["admin", "certificates", "detail", publicId],
    queryFn: () => nativeApi.admin.certificates.detail(publicId),
    enabled: Boolean(publicId),
  });
}

export function useRevokeAdminCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {any} */ { publicId, reason }) => nativeApi.admin.certificates.revoke(publicId, { reason }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["certificationEligibility"] });
    },
  });
}
