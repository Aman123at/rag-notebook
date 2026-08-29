/**
 * The two halves joined: a stream that cannot open must end in the sources list
 * being polled. `source-status-stream.test.ts` proves the feed reports itself
 * lost and `use-source-status-stream.test.tsx` proves the hook polls while it
 * is — but nothing there runs the real module against a real hook, so a
 * mismatched callback name between them would pass both suites.
 *
 * This test uses the real subscription module and stubs only `fetch`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { useSourceStatusStream } from "@/hooks/use-source-status-stream";
import { sourcesQueryKey } from "@/hooks/use-sources";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a stream that cannot open", () => {
  it("ends up polling the sources list", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    const { unmount } = renderHook(() => useSourceStatusStream("ws_poll"), { wrapper: Wrapper });

    // The first opening attempt fails, and three seconds later the fallback
    // has refetched the list — no live feed, but no stalled UI either.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sourcesQueryKey("ws_poll") });

    invalidate.mockClear();
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
