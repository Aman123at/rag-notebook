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
import {
  isPodcastInProgress,
  type Podcast,
} from "@/types/podcast.types";

export type { Podcast, PodcastStatus, PodcastStaleReason } from "@/types/podcast.types";
export { isPodcastInProgress } from "@/types/podcast.types";

export function podcastQueryKey(workspaceId: string) {
  return ["workspaces", workspaceId, "podcast"] as const;
}

/** How often to re-poll while the podcast is still being produced. */
const POLL_MS = 2_500;

/**
 * The workspace's podcast, or null if none has been generated. Polls itself
 * while the podcast is in a producing phase (PENDING/SCRIPTING/SYNTHESIZING)
 * and stops the moment it reaches READY or FAILED — the server mints a fresh
 * signed `audioUrl` on every GET, so a refetch is also how an expired URL is
 * renewed.
 */
export function usePodcast(workspaceId: string): UseQueryResult<Podcast | null> {
  const api = useApi();
  return useQuery({
    queryKey: podcastQueryKey(workspaceId),
    queryFn: () =>
      api.gap.GET("/workspaces/{workspaceId}/podcast", {
        params: { path: { workspaceId } },
      }),
    enabled: workspaceId.length > 0,
    refetchInterval: (query) => {
      const podcast = query.state.data;
      return podcast && isPodcastInProgress(podcast.status) ? POLL_MS : false;
    },
  });
}

/**
 * Kick off generation. Returns the PENDING podcast (202); the seeded query data
 * flips `usePodcast` into its polling loop without waiting for the next refetch.
 */
export function useGeneratePodcast(
  workspaceId: string,
): UseMutationResult<Podcast, ApiError, void> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.gap.POST("/workspaces/{workspaceId}/podcast", {
        params: { path: { workspaceId } },
      }),
    onSuccess: (podcast) => {
      qc.setQueryData(podcastQueryKey(workspaceId), podcast);
    },
  });
}

/** Hard-delete the podcast and free its slot. Clears the cached podcast to null. */
export function useDeletePodcast(
  workspaceId: string,
): UseMutationResult<{ id: string; deleted: true }, ApiError, void> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.gap.DELETE("/workspaces/{workspaceId}/podcast", {
        params: { path: { workspaceId } },
      }),
    onSuccess: () => {
      qc.setQueryData(podcastQueryKey(workspaceId), null);
    },
  });
}
