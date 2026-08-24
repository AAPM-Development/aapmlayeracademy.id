import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";

export function useLearningProfile() {
  return useQuery({
    queryKey: ["learning-profile"],
    queryFn: () => nativeApi.profile.get(),
  });
}

export function useHallOfFame() {
  return useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: () => nativeApi.profile.hallOfFame(),
  });
}

export function useSaveLearningProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.profile.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-profile"] });
      queryClient.invalidateQueries({ queryKey: ["hall-of-fame"] });
    },
  });
}
