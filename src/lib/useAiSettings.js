import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";

export function useAiAccountSettings() {
  return useQuery({
    queryKey: ["ai-account-settings"],
    queryFn: () => nativeApi.aiSettings.get(),
  });
}

export function useSaveAiAccountSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => nativeApi.aiSettings.update(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-account-settings"], data);
    },
  });
}
