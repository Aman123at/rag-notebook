"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ApiError } from "@/lib/api/errors";
import type { PostResult } from "@/lib/api/types";
import type { Chat } from "@/types/chats.types";

export type { Chat } from "@/types/chats.types";

export function chatsQueryKey(workspaceId: string) {
  return ["workspaces", workspaceId, "chats"] as const;
}

export function useChats(workspaceId: string): UseQueryResult<Chat[]> {
  const api = useApi();
  return useQuery({
    queryKey: chatsQueryKey(workspaceId),
    queryFn: () =>
      api.GET("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId } },
      }),
  });
}

export function useCreateChat(): UseMutationResult<
  PostResult<"/workspaces/{workspaceId}/chats">,
  ApiError,
  { workspaceId: string; title?: string }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, title }) =>
      api.POST("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId } },
        body: title === undefined ? {} : { title },
      }),
    onSuccess: (created, { workspaceId }) => {
      qc.setQueryData<Chat[]>(chatsQueryKey(workspaceId), (prev) =>
        prev ? [created, ...prev] : [created],
      );
    },
  });
}
