"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";

export function useUpdateMe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ displayName }: { displayName: string }) =>
      api.PATCH("/me", { body: { displayName } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
