import { vi } from "vitest";
import { ApiContext } from "@/providers/api";
import type { Api } from "@/lib/api/client";

export { ApiContext };

/**
 * Build a Vitest-mocked API. Every method is a vi.fn() so tests can stub per
 * endpoint. `LIST` is the envelope-preserving GET (`use-workspace-chat-count`
 * reads `meta.total` through it); `gap.POST` is the door for the two routes the
 * vendored contract types describe wrongly.
 */
export function makeApiMock(): Api {
  const api: Api = {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
    LIST: vi.fn(),
    gap: { POST: vi.fn() },
  };
  return api;
}
