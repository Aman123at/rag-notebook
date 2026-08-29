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
import type { Workspace, WorkspaceCreated } from "@/types/workspaces.types";

export type { Workspace, WorkspaceCreated } from "@/types/workspaces.types";

export const WORKSPACES_QUERY_KEY = ["workspaces"] as const;

export function useWorkspaces(): UseQueryResult<Workspace[]> {
  const api = useApi();
  return useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: () => api.GET("/workspaces"),
  });
}

/**
 * Create a workspace. NOT optimistic — server assigns the id, so we wait for the
 * response and then push it into the cached list. CONFLICT (409) and
 * PLAN_LIMIT_EXCEEDED (402) surface as typed `ApiError` for the caller to
 * render inline.
 */
export function useCreateWorkspace(): UseMutationResult<
  WorkspaceCreated,
  ApiError,
  { name: string; description?: string }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      api.POST("/workspaces", { body: body.description ? body : { name: body.name } }),
    onSuccess: (created) => {
      qc.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (prev) => {
        const next = prev ? [...prev, created] : [created];
        return next.sort(byCreatedAtDesc);
      });
    },
  });
}

export function useRenameWorkspace(): UseMutationResult<
  Workspace,
  ApiError,
  { id: string; name: string },
  { previous: Workspace[] | undefined }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }) =>
      api.PATCH("/workspaces/{workspaceId}", {
        params: { path: { workspaceId: id } },
        body: { name },
      }),
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: WORKSPACES_QUERY_KEY });
      const previous = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      if (previous) {
        qc.setQueryData<Workspace[]>(
          WORKSPACES_QUERY_KEY,
          previous.map((w) => (w.id === id ? { ...w, name } : w)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(WORKSPACES_QUERY_KEY, ctx.previous);
    },
    onSuccess: (updated) => {
      qc.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (prev) =>
        prev ? prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)) : prev,
      );
    },
  });
}

export function useDeleteWorkspace(): UseMutationResult<
  { id: string; deleted: true },
  ApiError,
  { id: string },
  { previous: Workspace[] | undefined }
> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) =>
      api.DELETE("/workspaces/{workspaceId}", { params: { path: { workspaceId: id } } }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: WORKSPACES_QUERY_KEY });
      const previous = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      if (previous) {
        qc.setQueryData<Workspace[]>(
          WORKSPACES_QUERY_KEY,
          previous.filter((w) => w.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(WORKSPACES_QUERY_KEY, ctx.previous);
    },
  });
}

function byCreatedAtDesc(a: Workspace, b: Workspace): number {
  return b.createdAt.localeCompare(a.createdAt);
}
