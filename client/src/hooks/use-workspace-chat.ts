"use client";

import * as React from "react";
import { useApi } from "@/providers/api";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { chatsQueryKey, type Chat } from "./use-chats";

/**
 * One chat per workspace. Lists the workspace's chats and, if none exist,
 * creates one on demand. Returns the (single) chat.
 *
 * The server contract still exposes multi-chat routes; this hook is the client
 * convention that collapses the model. If the list has more than one chat, the
 * newest is returned and the rest are ignored.
 */
export function useWorkspaceChat(
  workspaceId: string,
): UseQueryResult<Chat, ApiError> {
  const api = useApi();
  const qc = useQueryClient();
  const provisioningRef = React.useRef<string | null>(null);

  return useQuery<Chat, ApiError>({
    queryKey: [...chatsQueryKey(workspaceId), "singleton"] as const,
    queryFn: async () => {
      const list = await api.GET("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId } },
      });
      if (list.length > 0) {
        qc.setQueryData<Chat[]>(chatsQueryKey(workspaceId), list);
        const first = list[0];
        if (first) return first;
      }
      // Guard against a StrictMode double-invoke racing two POSTs.
      if (provisioningRef.current === workspaceId) {
        const existing = qc.getQueryData<Chat[]>(chatsQueryKey(workspaceId));
        const existingFirst = existing?.[0];
        if (existingFirst) return existingFirst;
      }
      provisioningRef.current = workspaceId;
      try {
        const created = await api.POST("/workspaces/{workspaceId}/chats", {
          params: { path: { workspaceId } },
          body: {},
        });
        qc.setQueryData<Chat[]>(chatsQueryKey(workspaceId), (prev) =>
          prev ? [created, ...prev] : [created],
        );
        return created;
      } finally {
        provisioningRef.current = null;
      }
    },
    staleTime: 60_000,
  });
}
