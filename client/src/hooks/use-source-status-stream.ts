"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  subscribeToSourceStatus,
  type SourceStatusEvent,
} from "@/lib/api/source-status-stream";
import { sourcesQueryKey, type Source } from "@/hooks/use-sources";

const POLL_INTERVAL_MS = 3_000;

export function useSourceStatusStream(workspaceId: string): void {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  React.useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer === null) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = setInterval(() => {
        void qc.invalidateQueries({ queryKey: sourcesQueryKey(workspaceId) });
      }, POLL_INTERVAL_MS);
    };

    const applyEvent = (evt: SourceStatusEvent) => {
      const current = qc.getQueryData<Source[]>(sourcesQueryKey(workspaceId));

      if (current && !current.some((s) => s.id === evt.sourceId)) {
        void qc.invalidateQueries({ queryKey: sourcesQueryKey(workspaceId) });
        return;
      }
      qc.setQueryData<Source[]>(sourcesQueryKey(workspaceId), (prev) =>
        prev
          ? prev.map((s) =>
              s.id === evt.sourceId
                ? {
                    ...s,
                    status: evt.status,
                    displayStatus: evt.displayStatus,
                    chunkCount: evt.chunkCount,
                  }
                : s,
            )
          : prev,
      );
    };

    const unsubscribe = subscribeToSourceStatus({
      workspaceId,
      getToken: async () => (await getToken()) ?? null,
      onEvent: applyEvent,
      onStateChange: (state) => (state === "open" ? stopPolling() : startPolling()),
    });

    return () => {
      unsubscribe();
      stopPolling();
    };
  }, [workspaceId, getToken, qc]);
}
