/**
 * The source pipeline's live feed (ticket 04). CLIENT-PLAN §9.2 #3 names the
 * subscription lifecycle as one of the four suites that carry the most weight:
 * "leaked streams accumulate silently", so teardown and retry are asserted
 * here rather than assumed.
 *
 * `fetch` is stubbed for the same reason as in `client.test.ts` — the transport
 * itself is the subject.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  subscribeToSourceStatus,
  type SourceStatusEvent,
  type StreamState,
} from "@/lib/api/source-status-stream";

/** A response body the test pushes frames into and closes when it likes. */
function controllable() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
  });
  return {
    stream,
    push: (frame: string) => ctrl.enqueue(encoder.encode(frame)),
    close: () => ctrl.close(),
  };
}

function statusFrame(overrides: Partial<SourceStatusEvent> = {}): string {
  const data = {
    sourceId: "src_1",
    status: "CHUNKING",
    displayStatus: "processing",
    chunkCount: 0,
    ...overrides,
  };
  return `event: source_status\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Collect what one subscriber saw. */
function recorder() {
  const events: SourceStatusEvent[] = [];
  const states: StreamState[] = [];
  return {
    events,
    states,
    onEvent: (e: SourceStatusEvent) => events.push(e),
    onStateChange: (s: StreamState) => states.push(s),
  };
}

const getToken = async () => "test-token";

/**
 * Let the stream retry loop run to its next await without moving the clock.
 * `vi.waitFor` advances fake timers on its own, which would smuggle a backoff
 * forward and make the timing assertions below meaningless.
 */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/** Signals handed to fetch, so teardown can be asserted rather than trusted. */
function stubFetch(respond: () => Response | Promise<Response>) {
  const signals: AbortSignal[] = [];
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    return respond();
  });
  vi.stubGlobal("fetch", fn);
  return { fn, signals };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("subscribeToSourceStatus", () => {
  it("delivers parsed status events and reports the stream open", async () => {
    const body = controllable();
    stubFetch(() => new Response(body.stream, { status: 200 }));
    const sub = recorder();

    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_events", getToken, ...sub });
    await vi.waitFor(() => expect(sub.states).toEqual(["open"]));

    body.push(statusFrame({ sourceId: "src_a", chunkCount: 3 }));
    await vi.waitFor(() => expect(sub.events).toHaveLength(1));
    expect(sub.events[0]).toEqual({
      sourceId: "src_a",
      status: "CHUNKING",
      displayStatus: "processing",
      chunkCount: 3,
    });

    unsubscribe();
  });

  it("ignores heartbeats and drops a status payload that fails its shape check", async () => {
    const body = controllable();
    stubFetch(() => new Response(body.stream, { status: 200 }));
    const sub = recorder();
    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_junk", getToken, ...sub });
    await vi.waitFor(() => expect(sub.states).toEqual(["open"]));

    body.push('event: heartbeat\ndata: {"t":1}\n\n');
    body.push('event: source_status\ndata: {"sourceId":"src_a"}\n\n');
    body.push(": keepalive\n\n");
    body.push(statusFrame({ sourceId: "src_good" }));

    await vi.waitFor(() => expect(sub.events).toHaveLength(1));
    expect(sub.events[0]?.sourceId).toBe("src_good");

    unsubscribe();
  });

  it("opens one stream for many subscribers to the same workspace", async () => {
    const body = controllable();
    const { fn } = stubFetch(() => new Response(body.stream, { status: 200 }));
    const first = recorder();
    const second = recorder();

    const closeFirst = subscribeToSourceStatus({ workspaceId: "ws_shared", getToken, ...first });
    const closeSecond = subscribeToSourceStatus({ workspaceId: "ws_shared", getToken, ...second });
    await vi.waitFor(() => expect(first.states).toEqual(["open"]));

    expect(fn).toHaveBeenCalledTimes(1);
    body.push(statusFrame({ sourceId: "src_both" }));
    await vi.waitFor(() => {
      expect(first.events).toHaveLength(1);
      expect(second.events).toHaveLength(1);
    });

    closeFirst();
    closeSecond();
  });

  it("keeps the stream while any subscriber remains, and aborts when the last leaves", async () => {
    const body = controllable();
    const { signals } = stubFetch(() => new Response(body.stream, { status: 200 }));
    const first = recorder();
    const second = recorder();

    const closeFirst = subscribeToSourceStatus({ workspaceId: "ws_refcount", getToken, ...first });
    const closeSecond = subscribeToSourceStatus({ workspaceId: "ws_refcount", getToken, ...second });
    await vi.waitFor(() => expect(signals).toHaveLength(1));

    closeFirst();
    expect(signals[0]?.aborted).toBe(false);
    closeSecond();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("opens a separate stream per workspace", async () => {
    const { fn } = stubFetch(() => new Response(controllable().stream, { status: 200 }));
    const a = recorder();
    const b = recorder();
    const closeA = subscribeToSourceStatus({ workspaceId: "ws_one", getToken, ...a });
    const closeB = subscribeToSourceStatus({ workspaceId: "ws_two", getToken, ...b });
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    expect(fn.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8080/api/v1/workspaces/ws_one/sources/events",
      "http://localhost:8080/api/v1/workspaces/ws_two/sources/events",
    ]);
    closeA();
    closeB();
  });

  it("sends the auth and contract-version headers", async () => {
    const { fn } = stubFetch(() => new Response(controllable().stream, { status: 200 }));
    const sub = recorder();
    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_headers", getToken, ...sub });
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));

    const [url, init] = fn.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:8080/api/v1/workspaces/ws_headers/sources/events");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["X-Contract-Version"]).toBe("0.1.0");
    expect(headers.Accept).toBe("text/event-stream");

    unsubscribe();
  });

  it("reports the stream lost on a failed open and retries after a backoff", async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const body = controllable();
    const { fn } = stubFetch(() => {
      attempt += 1;
      return attempt === 1
        ? new Response("nope", { status: 503 })
        : new Response(body.stream, { status: 200 });
    });
    const sub = recorder();

    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_retry", getToken, ...sub });
    await settle();
    expect(sub.states).toEqual(["lost"]);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sub.states).toEqual(["lost", "open"]);

    unsubscribe();
  });

  /**
   * The backoff is the difference between a server that comes back and a
   * client that hammers it while it is down, so the schedule is pinned rather
   * than sampled: 1s, 2s, 4s, and nothing in between.
   */
  it("doubles the wait between attempts and never fires early", async () => {
    vi.useFakeTimers();
    const { fn } = stubFetch(() => new Response("nope", { status: 503 }));
    const sub = recorder();
    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_backoff", getToken, ...sub });
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);

    for (const gap of [1_000, 2_000, 4_000]) {
      await vi.advanceTimersByTimeAsync(gap - 1);
      const before = fn.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      expect(fn.mock.calls.length, `expected an attempt exactly ${gap}ms after the last`).toBe(
        before + 1,
      );
    }

    // The state is reported once, not once per failed attempt.
    expect(sub.states).toEqual(["lost"]);
    unsubscribe();
  });

  it("caps the wait at 30 seconds however long the outage lasts", async () => {
    vi.useFakeTimers();
    const { fn } = stubFetch(() => new Response("nope", { status: 503 }));
    const sub = recorder();
    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_cap", getToken, ...sub });
    await settle();

    // Run past the point where doubling would exceed the cap (1+2+4+8+16+32s).
    await vi.advanceTimersByTimeAsync(63_000);
    const attemptsSoFar = fn.mock.calls.length;

    // From here every attempt is 30s apart: two minutes buys exactly four.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fn.mock.calls.length).toBe(attemptsSoFar + 4);

    unsubscribe();
  });

  it("survives a subscriber that throws, and keeps feeding the others", async () => {
    const body = controllable();
    stubFetch(() => new Response(body.stream, { status: 200 }));
    const thrower = {
      onEvent: () => {
        throw new Error("boom");
      },
      onStateChange: () => {},
    };
    const healthy = recorder();
    const noise = vi.spyOn(console, "error").mockImplementation(() => {});

    const closeThrower = subscribeToSourceStatus({
      workspaceId: "ws_throw",
      getToken,
      ...thrower,
    });
    const closeHealthy = subscribeToSourceStatus({
      workspaceId: "ws_throw",
      getToken,
      ...healthy,
    });
    await vi.waitFor(() => expect(healthy.states).toEqual(["open"]));

    body.push(statusFrame({ sourceId: "src_1" }));
    body.push(statusFrame({ sourceId: "src_2" }));
    await vi.waitFor(() => expect(healthy.events).toHaveLength(2));
    // Still streaming: a throwing subscriber did not tear the shared feed down.
    expect(healthy.states).toEqual(["open"]);
    expect(noise).toHaveBeenCalledTimes(2);

    closeThrower();
    closeHealthy();
    noise.mockRestore();
  });

  it("treats a token that will not resolve as a failed open", async () => {
    vi.useFakeTimers();
    const { fn } = stubFetch(() => new Response(controllable().stream, { status: 200 }));
    let calls = 0;
    const failingToken = async () => {
      calls += 1;
      if (calls === 1) throw new Error("session expired");
      return "recovered-token";
    };
    const sub = recorder();

    const unsubscribe = subscribeToSourceStatus({
      workspaceId: "ws_token",
      getToken: failingToken,
      ...sub,
    });
    await settle();
    expect(sub.states).toEqual(["lost"]);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sub.states).toEqual(["lost", "open"]);

    unsubscribe();
  });

  /**
   * React can run a cleanup twice. Without a guard the second call closes a
   * channel a later subscriber has since reopened under the same key, leaving
   * a stream nobody holds a handle to.
   */
  it("ignores a second unsubscribe rather than closing someone else's channel", async () => {
    const { fn, signals } = stubFetch(() => new Response(controllable().stream, { status: 200 }));
    const first = recorder();
    const closeFirst = subscribeToSourceStatus({ workspaceId: "ws_twice", getToken, ...first });
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));

    closeFirst();
    const second = recorder();
    const closeSecond = subscribeToSourceStatus({ workspaceId: "ws_twice", getToken, ...second });
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));

    closeFirst(); // the stale cleanup, running late

    expect(signals[1]?.aborted).toBe(false);
    // The reopened channel is still the one the map holds, so closing it works.
    closeSecond();
    expect(signals[1]?.aborted).toBe(true);
  });

  it("retries when the server closes the stream cleanly", async () => {
    vi.useFakeTimers();
    const first = controllable();
    const second = controllable();
    let attempt = 0;
    const { fn } = stubFetch(() => {
      attempt += 1;
      return new Response(attempt === 1 ? first.stream : second.stream, { status: 200 });
    });
    const sub = recorder();

    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_reopen", getToken, ...sub });
    await vi.waitFor(() => expect(sub.states).toEqual(["open"]));

    first.close();
    await vi.waitFor(() => expect(sub.states).toEqual(["open", "lost"]));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));

    unsubscribe();
  });

  it("cancels a pending retry when the last subscriber leaves", async () => {
    vi.useFakeTimers();
    const { fn } = stubFetch(() => new Response("nope", { status: 503 }));
    const sub = recorder();

    const unsubscribe = subscribeToSourceStatus({ workspaceId: "ws_teardown", getToken, ...sub });
    await vi.waitFor(() => expect(sub.states).toEqual(["lost"]));
    unsubscribe();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("tells a subscriber that joins a downed stream so it can start polling", async () => {
    vi.useFakeTimers();
    stubFetch(() => new Response("nope", { status: 503 }));
    const first = recorder();
    const closeFirst = subscribeToSourceStatus({ workspaceId: "ws_late", getToken, ...first });
    await vi.waitFor(() => expect(first.states).toEqual(["lost"]));

    const late = recorder();
    const closeLate = subscribeToSourceStatus({ workspaceId: "ws_late", getToken, ...late });
    expect(late.states).toEqual(["lost"]);

    closeFirst();
    closeLate();
  });
});
