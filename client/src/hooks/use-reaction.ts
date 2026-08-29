"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import { ApiError } from "@/lib/api/errors";
import { messagesQueryKey, type Message } from "@/hooks/use-messages";
import type { PostResult } from "@/lib/api/types";
import type { ReactionBody } from "@/types/chats.types";

export type { DislikedReason, ReactionBody } from "@/types/chats.types";

interface ReactionContext {
  previous: Message[] | undefined;
}

export function useSetReaction(
  chatId: string,
): UseMutationResult<
  PostResult<"/messages/{messageId}/reaction">,
  ApiError,
  { messageId: string; body: ReactionBody },
  ReactionContext
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }) =>
      api.POST("/messages/{messageId}/reaction", {
        params: { path: { messageId } },
        body,
      }),
    // Optimistically flip the reaction so the thumb reflects the click
    // immediately — without this the button appears unchanged until the
    // round-trip lands, which reads as "nothing happened" and invites the
    // user to click again (firing duplicate calls).
    onMutate: async ({ messageId, body }): Promise<ReactionContext> => {
      await qc.cancelQueries({ queryKey: messagesQueryKey(chatId) });
      const previous = qc.getQueryData<Message[]>(messagesQueryKey(chatId));
      const nextReason = body.reaction === "dislike" ? body.dislikedReason ?? null : null;
      qc.setQueryData<Message[]>(messagesQueryKey(chatId), (prev) =>
        prev
          ? prev.map((m) =>
              m.id === messageId
                ? { ...m, reaction: body.reaction, dislikedReason: nextReason }
                : m,
            )
          : prev,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData<Message[]>(messagesQueryKey(chatId), context.previous);
      }
    },
    onSuccess: (updated) => {
      qc.setQueryData<Message[]>(messagesQueryKey(chatId), (prev) =>
        prev ? prev.map((m) => (m.id === updated.id ? updated : m)) : prev,
      );
    },
  });
}
