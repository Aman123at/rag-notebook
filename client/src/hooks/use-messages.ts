"use client";

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";
import type { Message } from "@/types/chats.types";

export type { Citation, Message, WebCitation } from "@/types/chats.types";

export function messagesQueryKey(chatId: string) {
  return ["chats", chatId, "messages"] as const;
}

export function useMessages(chatId: string): UseQueryResult<Message[]> {
  const api = useApi();
  return useQuery({
    queryKey: messagesQueryKey(chatId),
    queryFn: () =>
      api.GET("/chats/{chatId}/messages", {
        params: { path: { chatId } },
      }),
  });
}

/**
 * After a chat turn ends, the server has spent tokens and the /me quota is
 * stale — refetch it so every downstream badge is current (see CLAUDE.md §2.5).
 */
export function useRefetchMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
}
