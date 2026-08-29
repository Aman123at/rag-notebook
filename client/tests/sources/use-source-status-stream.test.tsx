/**
 * What the hook owns after ticket 04: cache-merge policy, and polling while the
 * feed is down. The stream is mocked at the API-layer boundary — per
 * CLIENT-PLAN §9.1 a consumer test mocks the client, not `fetch` — so these
 * tests drive the callbacks the real stream would call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type {
  SourceStatusEvent,
  SourceStatusSubscriber,
} from "@/lib/api/source-status-stream";

const unsubscribe = vi.fn();
const subscribers: SourceStatusSubscriber[] = [];

vi.mock("@/lib/api/source-status-stream", () => ({
  subscribeToSourceStatus: (subscriber: SourceStatusSubscriber) => {
    subscribers.push(subscriber);
    return unsubscribe;
  },
}));

import { useSourceStatusStream } from "@/hooks/use-source-status-stream";
import { sourcesQueryKey, type Source } from "@/hooks/use-sources";

const WORKSPACE_ID = "ws_1";

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "src_1",
    status: "CHUNKING",
    displayStatus: "processing",
    chunkCount: 0,
    parentSourceId: null,
    ...overrides,
  } as Source;
}

function statusEvent(overrides: Partial<SourceStatusEvent> = {}): SourceStatusEvent {
  return {
    sourceId: "src_1",
    status: "READY",
    displayStatus: "indexed",
    chunkCount: 12,
    ...overrides,
  };
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  const view = renderHook(() => useSourceStatusStream(WORKSPACE_ID), { wrapper: Wrapper });
  const subscriber = subscribers.at(-1);
  if (subscriber === undefined) throw new Error("the hook did not subscribe");
  return { qc, invalidate, subscriber, ...view };
}

beforeEach(() => {
  subscribers.length = 0;
  unsubscribe.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSourceStatusStream", () => {
  it("merges a status frame into the cached source it names", async () => {
    const { qc, subscriber } = setup();
    qc.setQueryData<Source[]>(sourcesQueryKey(WORKSPACE_ID), [
      makeSource({ id: "src_1" }),
      makeSource({ id: "src_2" }),
    ]);

    act(() => subscriber.onEvent(statusEvent({ sourceId: "src_1" })));

    const rows = qc.getQueryData<Source[]>(sourcesQueryKey(WORKSPACE_ID));
    expect(rows?.[0]).toMatchObject({
      id: "src_1",
      status: "READY",
      displayStatus: "indexed",
      chunkCount: 12,
    });
    // Untouched rows stay exactly as they were.
    expect(rows?.[1]).toMatchObject({ id: "src_2", status: "CHUNKING", chunkCount: 0 });
  });

  /**
   * A YouTube playlist's child videos are created after the parent is added, so
   * their first frame names an id the cache has never seen. Dropping it leaves
   * the playlist looking stuck until a manual refresh.
   */
  it("refetches the list when a frame names a source the cache has never seen", async () => {
    const { qc, invalidate, subscriber } = setup();
    qc.setQueryData<Source[]>(sourcesQueryKey(WORKSPACE_ID), [makeSource({ id: "src_1" })]);
    invalidate.mockClear();

    act(() => subscriber.onEvent(statusEvent({ sourceId: "src_unknown" })));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: sourcesQueryKey(WORKSPACE_ID) });
    // …and it does not invent a row for it.
    expect(qc.getQueryData<Source[]>(sourcesQueryKey(WORKSPACE_ID))).toHaveLength(1);
  });

  it("polls while the stream is down and stops once it returns", async () => {
    vi.useFakeTimers();
    const { invalidate, subscriber } = setup();
    invalidate.mockClear();

    act(() => subscriber.onStateChange("lost"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_500);
    });
    expect(invalidate).toHaveBeenCalledTimes(2);

    invalidate.mockClear();
    act(() => subscriber.onStateChange("open"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount and stops polling with it", async () => {
    vi.useFakeTimers();
    const { invalidate, subscriber, unmount } = setup();
    act(() => subscriber.onStateChange("lost"));
    invalidate.mockClear();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("resubscribes when the workspace changes", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useSourceStatusStream(id),
      { wrapper: Wrapper, initialProps: { id: "ws_a" } },
    );
    expect(subscribers.at(-1)?.workspaceId).toBe("ws_a");

    rerender({ id: "ws_b" });

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
    expect(subscribers.at(-1)?.workspaceId).toBe("ws_b");
  });
});
