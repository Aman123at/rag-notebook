"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import type { SourcePreview } from "@/types/sources.types";

export type { SourcePreview } from "@/types/sources.types";

export function sourcePreviewQueryKey(sourceId: string, chunkId: string) {
  return ["sources", sourceId, "preview", chunkId] as const;
}

/**
 * Lazily fetch a citation-preview payload for one chunk on one source.
 * `enabled` gates the request on the hover-card actually being opened,
 * so scrolling a long answer does not fan out N preview requests.
 */
export function useSourcePreview(
  sourceId: string,
  chunkId: string,
  enabled: boolean,
): UseQueryResult<SourcePreview> {
  const api = useApi();
  return useQuery({
    queryKey: sourcePreviewQueryKey(sourceId, chunkId),
    queryFn: () =>
      api.GET("/sources/{sourceId}/preview", {
        params: { path: { sourceId }, query: { chunkId } },
      }),
    enabled,
    staleTime: 4 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}
