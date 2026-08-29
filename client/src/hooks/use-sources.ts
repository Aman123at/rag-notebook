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
import type {
  Source,
  SourceDetail,
  UploadIntent,
  CreateSourceBody,
} from "@/types/sources.types";
import { WORKSPACES_QUERY_KEY } from "@/hooks/use-workspaces";

export type { Source, SourceDetail, UploadIntent } from "@/types/sources.types";

export function sourcesQueryKey(workspaceId: string) {
  return ["workspaces", workspaceId, "sources"] as const;
}

export function useSources(workspaceId: string): UseQueryResult<Source[]> {
  const api = useApi();
  return useQuery({
    queryKey: sourcesQueryKey(workspaceId),
    queryFn: () =>
      api.GET("/workspaces/{workspaceId}/sources", {
        params: { path: { workspaceId } },
      }),
    // Callers that learn the workspace from another request (the roadmap route
    // reads it off the source) pass "" on the first render. Firing that would
    // be a guaranteed 404 against `/workspaces//sources`.
    enabled: workspaceId.length > 0,
  });
}

export function sourceQueryKey(sourceId: string) {
  return ["sources", sourceId] as const;
}

/**
 * One source by id. The roadmap route only knows a source id, and needs the
 * workspace it belongs to before it can list that playlist's videos.
 */
export function useSource(sourceId: string): UseQueryResult<SourceDetail> {
  const api = useApi();
  return useQuery({
    queryKey: sourceQueryKey(sourceId),
    queryFn: () =>
      api.GET("/sources/{sourceId}", { params: { path: { sourceId } } }),
    // Callers on routes that may carry no source id pass "" rather than
    // branching; an empty id must never become a request for /sources/.
    enabled: sourceId.length > 0,
  });
}

export function useUploadIntent(): UseMutationResult<
  UploadIntent,
  ApiError,
  { workspaceId: string; fileName: string; mimeType: string; sizeBytes: number }
> {
  const api = useApi();
  return useMutation({
    mutationFn: ({ workspaceId, ...body }) =>
      api.POST("/workspaces/{workspaceId}/sources/upload-intent", {
        params: { path: { workspaceId } },
        body,
      }),
  });
}

export type { CreateSourceBody } from "@/types/sources.types";

/**
 * Create a source. This route and `useRetrySource` below are typed
 * `requestBody?: never` by the vendored contract even though the server
 * requires a body — CONTRACT-FEEDBACK #2 — so both go through `api.gap`, the
 * API layer's one documented door for a route the contract describes wrongly
 * (see `src/lib/api/contract-gaps.ts`). They are as type-checked as any other
 * call and carry the same auth header, request id and error mapping.
 */
export function useCreateSource(): UseMutationResult<
  Source,
  ApiError,
  { workspaceId: string; body: CreateSourceBody }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, body }) =>
      api.gap.POST("/workspaces/{workspaceId}/sources", {
        params: { path: { workspaceId } },
        body,
      }),
    onSuccess: (created, { workspaceId }) => {
      qc.setQueryData<Source[]>(sourcesQueryKey(workspaceId), (prev) =>
        prev ? [created, ...prev] : [created],
      );
      qc.setQueryData<{ id: string; sourceCount: number }[]>(
        WORKSPACES_QUERY_KEY,
        (prev) =>
          prev
            ? prev.map((w) =>
                w.id === workspaceId ? { ...w, sourceCount: w.sourceCount + 1 } : w,
              )
            : prev,
      );
    },
  });
}

export function useDeleteSource(): UseMutationResult<
  { id: string; deleted: true },
  ApiError,
  { workspaceId: string; sourceId: string }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId }) =>
      api.DELETE("/sources/{sourceId}", { params: { path: { sourceId } } }),
    onSuccess: (_res, { workspaceId, sourceId }) => {
      qc.setQueryData<Source[]>(sourcesQueryKey(workspaceId), (prev) =>
        prev ? prev.filter((s) => s.id !== sourceId) : prev,
      );
      qc.setQueryData<{ id: string; sourceCount: number }[]>(
        WORKSPACES_QUERY_KEY,
        (prev) =>
          prev
            ? prev.map((w) =>
                w.id === workspaceId
                  ? { ...w, sourceCount: Math.max(0, w.sourceCount - 1) }
                  : w,
              )
            : prev,
      );
    },
  });
}

export function useRetrySource(): UseMutationResult<
  Source,
  ApiError,
  { workspaceId: string; sourceId: string }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId }) =>
      api.gap.POST("/sources/{sourceId}/retry", {
        params: { path: { sourceId } },
        // Retry sends no body, and openapi-fetch omits Content-Type when there
        // is none. The wrapper this replaced always sent it, and this route has
        // never been exercised against a live failed source, so keep the header
        // rather than discover the server needs it.
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (updated, { workspaceId }) => {
      qc.setQueryData<Source[]>(sourcesQueryKey(workspaceId), (prev) =>
        prev ? prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)) : prev,
      );
    },
  });
}

/**
 * Fetch a short-lived (~5 min) signed download URL for the original upload.
 * Must be called at click time, not at render time — see CLIENT-PLAN.md §4.5.
 */
export function useDownloadSource(): UseMutationResult<
  { url: string; expiresAt: string },
  ApiError,
  { sourceId: string }
> {
  const api = useApi();
  return useMutation({
    mutationFn: ({ sourceId }) =>
      api.GET("/sources/{sourceId}/download", { params: { path: { sourceId } } }),
  });
}

export type { UploadEnvelope } from "@/interfaces/sources.interface";
