"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/providers/api";
import type { Artifact, ArtifactDetail } from "@/types/artifacts.types";

export type { Artifact, ArtifactDetail } from "@/types/artifacts.types";

export function artifactsQueryKey(sourceId: string) {
  return ["sources", sourceId, "artifacts"] as const;
}

export function artifactQueryKey(artifactId: string) {
  return ["artifacts", artifactId] as const;
}

/**
 * Latest-first list of derived artifacts for a source. The C6 renderer picks
 * the first PLAYLIST_ROADMAP entry — the server orders newest-first (v0.6.0).
 */
export function useSourceArtifacts(sourceId: string): UseQueryResult<Artifact[]> {
  const api = useApi();
  return useQuery({
    queryKey: artifactsQueryKey(sourceId),
    queryFn: () =>
      api.GET("/sources/{sourceId}/artifacts", {
        params: { path: { sourceId } },
      }),
  });
}

/**
 * Fetch one artifact by id. Used when the caller already has the id (e.g.
 * from a deep link). The list-item shape already carries `content`, so most
 * callers can render from `useSourceArtifacts` alone.
 */
export function useArtifact(artifactId: string): UseQueryResult<ArtifactDetail> {
  const api = useApi();
  return useQuery({
    queryKey: artifactQueryKey(artifactId),
    queryFn: () =>
      api.GET("/artifacts/{artifactId}", {
        params: { path: { artifactId } },
      }),
  });
}
