/**
 * Characterization tests for the transport layer (ticket 01).
 *
 * These pin down what `createApi` does *today* — request middleware, envelope
 * unwrapping, error mapping and contract-drift warning — so that later tickets
 * which move this code find out immediately if they changed behaviour.
 *
 * CLIENT-PLAN §9.1 says "mock the API client, never `fetch`". That rule is for
 * tests of code that *consumes* the client; here the client is the subject, and
 * mocking it would leave exactly the envelope parsing §9.1 is protecting
 * untested. This file and `stream.test.ts` are the only place the exception
 * applies — a screen test that stubs `fetch` is still wrong.
 *
 * Two details shape how the suite is written:
 *   1. `openapi-fetch` captures `globalThis.fetch` when the client is created,
 *      so the stub must be installed before `createApi`.
 *   2. the drift warning latches in a module-level variable, so any test that
 *      cares about the latch imports a fresh copy of the module. Because that
 *      also produces a fresh `ApiError` class, failures are asserted on their
 *      fields rather than with `instanceof`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract version this suite runs against. Set by `vitest.config.ts`, not
 * by `.env` — change it there and change it here, or the drift tests below
 * silently stop testing drift (a "major mismatch" fixture built for 0.x is a
 * same-major case under 1.x).
 */
const CLIENT_CONTRACT_VERSION = "0.1.0";

type Handler = (request: Request) => Response | Promise<Response>;

/** Install a fetch stub and return the list of requests it observes. */
function stubFetch(handler: Handler): Request[] {
  const seen: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      seen.push(request);
      return handler(request);
    }),
  );
  return seen;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

/** Import a pristine copy of the client module (resets the drift latch). */
async function freshModule(): Promise<typeof import("@/lib/api/client")> {
  vi.resetModules();
  return import("@/lib/api/client");
}

const token = async () => "test-token";

/**
 * Stub a 200 response, import a pristine client module, and return both the
 * request log and a ready-made client.
 */
async function setup(
  getToken: () => Promise<string | null> = token,
): Promise<{ seen: Request[]; api: ReturnType<typeof import("@/lib/api/client").createApi> }> {
  const seen = stubFetch(() => json({ data: { status: "ok" } }));
  const { createApi } = await freshModule();
  return { seen, api: createApi(getToken) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("request middleware", () => {
  it("attaches the Clerk bearer token when one resolves", async () => {
    const { seen, api } = await setup(async () => "abc123");
    await api.GET("/healthz");
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer abc123");
  });

  it("omits Authorization when no token resolves", async () => {
    const { seen, api } = await setup(async () => null);
    await api.GET("/healthz");
    expect(seen[0]?.headers.has("Authorization")).toBe(false);
  });

  it("always sets X-Contract-Version to the version this bundle was built against", async () => {
    const { seen, api } = await setup();
    await api.GET("/healthz");
    expect(seen[0]?.headers.get("X-Contract-Version")).toBe(CLIENT_CONTRACT_VERSION);
  });

  it("generates a fresh x-request-id per request when the caller supplies none", async () => {
    const { seen, api } = await setup();
    await api.GET("/healthz");
    await api.GET("/healthz");
    const first = seen[0]?.headers.get("x-request-id");
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(seen[1]?.headers.get("x-request-id")).not.toBe(first);
  });

  it("preserves an x-request-id the caller supplied", async () => {
    const { seen, api } = await setup();
    await api.GET("/healthz", { headers: { "x-request-id": "caller-supplied" } });
    expect(seen[0]?.headers.get("x-request-id")).toBe("caller-supplied");
  });
});

describe("envelope handling", () => {
  it("unwraps a { data } success body to data", async () => {
    stubFetch(() => json({ data: { status: "ok" } }));
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/healthz")).resolves.toEqual({ status: "ok" });
  });

  /**
   * Ticket 03 changes this: `meta` is dropped on the floor today, so callers
   * that need pagination cannot reach it. Pinned here so the change is visible.
   */
  it("drops meta — a { data, meta } body still unwraps to data alone", async () => {
    stubFetch(() =>
      json({ data: [{ id: "ws_1" }], meta: { page: 1, pageSize: 20, total: 1, hasMore: false } }),
    );
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).resolves.toEqual([{ id: "ws_1" }]);
  });
});

describe("LIST — a GET that keeps the envelope", () => {
  it("returns data and meta together", async () => {
    stubFetch(() =>
      json({ data: [{ id: "chat_1" }], meta: { page: 1, pageSize: 1, total: 42, hasMore: true } }),
    );
    const { createApi } = await freshModule();
    await expect(
      createApi(token).LIST("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId: "ws_1" }, query: { pageSize: 1, page: 1 } },
      }),
    ).resolves.toEqual({
      data: [{ id: "chat_1" }],
      meta: { page: 1, pageSize: 1, total: 42, hasMore: true },
    });
  });

  it("reports meta as undefined when the server sends none", async () => {
    stubFetch(() => json({ data: [] }));
    const { createApi } = await freshModule();
    const result = await createApi(token).LIST("/workspaces/{workspaceId}/chats", {
      params: { path: { workspaceId: "ws_1" } },
    });
    expect(result.data).toEqual([]);
    // `toEqual` ignores undefined-valued keys, so assert the key exists and is
    // undefined — a LIST that silently dropped `meta` would pass otherwise.
    expect(Object.hasOwn(result, "meta")).toBe(true);
    expect(result.meta).toBeUndefined();
  });

  it("maps failures the same way GET does", async () => {
    stubFetch(() =>
      json(
        { error: { code: "NOT_FOUND", message: "No such workspace.", requestId: "req_1" } },
        { status: 404 },
      ),
    );
    const { createApi } = await freshModule();
    await expect(
      createApi(token).LIST("/workspaces/{workspaceId}/chats", {
        params: { path: { workspaceId: "ws_gone" } },
      }),
    ).rejects.toMatchObject({ name: "ApiError", code: "NOT_FOUND", status: 404 });
  });
});

/**
 * The contract-gap door. What matters here is not that a POST works, but that a
 * body reaches the wire on a route the vendored types declare `requestBody?:
 * never`, and that going through that door costs none of the transport
 * guarantees — same headers, same envelope, same typed errors.
 */
describe("gap.POST — routes the contract types get wrong", () => {
  const createBody = {
    type: "WEB_URL",
    url: "https://example.com/article",
  } as const;

  it("sends the JSON body the server requires and unwraps the envelope", async () => {
    const seen = stubFetch(() => json({ data: { id: "src_1", title: "Article" } }));
    const { createApi } = await freshModule();
    const created = await createApi(token).gap.POST("/workspaces/{workspaceId}/sources", {
      params: { path: { workspaceId: "ws_1" } },
      body: createBody,
    });
    expect(created).toEqual({ id: "src_1", title: "Article" });
    const request = seen[0];
    expect(request?.method).toBe("POST");
    expect(new URL(request?.url ?? "").pathname).toBe("/api/v1/workspaces/ws_1/sources");
    expect(await request?.clone().json()).toEqual(createBody);
  });

  it("carries the auth, contract-version and request-id headers", async () => {
    const seen = stubFetch(() => json({ data: { id: "src_1" } }));
    const { createApi } = await freshModule();
    await createApi(async () => "abc123").gap.POST("/sources/{sourceId}/retry", {
      params: { path: { sourceId: "src_1" } },
    });
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer abc123");
    expect(seen[0]?.headers.get("X-Contract-Version")).toBe(CLIENT_CONTRACT_VERSION);
    expect(seen[0]?.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  /**
   * Regression: openapi-fetch omits Content-Type when a request has no body,
   * and retry has none. The hand-rolled wrapper this replaced always sent it,
   * so `useRetrySource` sets it explicitly — this pins that it survives.
   */
  it("keeps the Content-Type retry was always sent with, despite having no body", async () => {
    const seen = stubFetch(() => json({ data: { id: "src_1" } }));
    const { createApi } = await freshModule();
    await createApi(token).gap.POST("/sources/{sourceId}/retry", {
      params: { path: { sourceId: "src_1" } },
      headers: { "Content-Type": "application/json" },
    });
    expect(seen[0]?.headers.get("Content-Type")).toBe("application/json");
    expect(seen[0]?.body).toBeNull();
  });

  it("maps failures to a typed ApiError", async () => {
    stubFetch(() =>
      json(
        {
          error: {
            code: "SOURCE_NOT_READY",
            message: "This source cannot be retried.",
            requestId: "req_1",
          },
        },
        { status: 409 },
      ),
    );
    const { createApi } = await freshModule();
    await expect(
      createApi(token).gap.POST("/sources/{sourceId}/retry", {
        params: { path: { sourceId: "src_1" } },
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "SOURCE_NOT_READY",
      status: 409,
      requestId: "req_1",
    });
  });
});

describe("error mapping", () => {
  it("maps a parseable error envelope to its code, status and requestId", async () => {
    stubFetch(() =>
      json(
        {
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: "Workspace limit reached.",
            requestId: "req_from_body",
            details: { limit: 3 },
          },
        },
        { status: 403 },
      ),
    );
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).rejects.toMatchObject({
      name: "ApiError",
      code: "PLAN_LIMIT_EXCEEDED",
      status: 403,
      requestId: "req_from_body",
      message: "Workspace limit reached.",
      details: { limit: 3 },
    });
  });

  it("falls back to the response header request id when the envelope carries none", async () => {
    stubFetch(() =>
      json(
        { error: { code: "NOT_FOUND", message: "No such workspace.", requestId: "" } },
        { status: 404, headers: { "x-request-id": "req_from_header" } },
      ),
    );
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      status: 404,
      requestId: "req_from_header",
    });
  });

  it("maps a non-2xx with an unparseable body to UNKNOWN", async () => {
    stubFetch(
      () =>
        new Response("<html>502 Bad Gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html", "x-request-id": "req_gateway" },
        }),
    );
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 502,
      requestId: "req_gateway",
      message: "Request failed (502)",
    });
  });

  it('uses the "unknown" request id when the server sends no header either', async () => {
    stubFetch(() => new Response("nope", { status: 500 }));
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 500,
      requestId: "unknown",
    });
  });

  it("maps a fetch that never produced a response to status 0 with a generated request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { createApi } = await freshModule();
    await expect(createApi(token).GET("/workspaces")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 0,
      message: "Failed to fetch",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
});

describe("contract-drift warning", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("warns on a major mismatch", async () => {
    const { warnOnContractDrift } = await freshModule();
    warnOnContractDrift("1.0.0");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("[contract-drift]");
  });

  it("warns only once per page load, however many responses drift", async () => {
    const { warnOnContractDrift } = await freshModule();
    warnOnContractDrift("1.0.0");
    warnOnContractDrift("2.0.0");
    warnOnContractDrift("3.0.0");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("stays silent on a minor mismatch, an exact match, and a missing header", async () => {
    const { warnOnContractDrift } = await freshModule();
    warnOnContractDrift("0.9.0");
    warnOnContractDrift(CLIENT_CONTRACT_VERSION);
    warnOnContractDrift(null);
    expect(warn).not.toHaveBeenCalled();
  });

  it("runs on every response that passes through the client", async () => {
    stubFetch(() =>
      json({ data: { status: "ok" } }, { headers: { "X-Contract-Version": "9.0.0" } }),
    );
    const { createApi } = await freshModule();
    await createApi(token).GET("/healthz");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
