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
    mutationFn: () => nativeApi.admin.aiSettings.test(),
  });
}
