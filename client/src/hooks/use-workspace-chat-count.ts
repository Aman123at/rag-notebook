"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/providers/api";

/**
 * Fetches the chat count for a workspace — used only by the delete confirmation
 * dialog to render "This deletes N sources and M chats".
 */
export function useWorkspaceChatCount(workspaceId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ["workspaces", workspaceId, "chats", "count"] as const,
    queryFn: async () => {
      // `LIST` rather than `GET` because `meta.total` is the count, and asking
      // for one row is cheaper than paging the whole list to length it.
      const { data, meta } = await api.LIST("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId }, query: { pageSize: 1, page: 1 } },
      });
      return meta?.total ?? data.length;
    },
    enabled,
    staleTime: 10_000,
  });
}
