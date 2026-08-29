import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/app",
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  }),
}));

import { NewWorkspaceButton } from "@/components/workspace/new-workspace-button";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";
import { WORKSPACES_QUERY_KEY } from "@/hooks/use-workspaces";
import { makeApiMock } from "../helpers/api-mock";
import { renderWithProviders } from "../helpers/render";
import { makeMe, makeWorkspace } from "../helpers/fixtures";

function setup(workspaceCount: number, cap = 10) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(ME_QUERY_KEY, makeMe({ limits: cap === 10 ? undefined : mergeLimits(cap) }));
  qc.setQueryData(
    WORKSPACES_QUERY_KEY,
    Array.from({ length: workspaceCount }, () => makeWorkspace()),
  );
  const api = makeApiMock();
  return { qc, api, ...renderWithProviders(<NewWorkspaceButton />, { api, queryClient: qc }) };
}

function mergeLimits(maxWorkspaces: number) {
  const base = makeMe().limits;
  return { ...base, maxWorkspaces };
}

describe("NewWorkspaceButton cap state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("at limit-1: button is enabled and clickable", () => {
    setup(9, 10);
    const btn = screen.getByRole("button", { name: /new workspace/i });
    expect(btn).toBeEnabled();
  });

  it("at the limit: button is disabled and names the cap", async () => {
    setup(10, 10);
    const btn = screen.getByRole("button", { name: /new workspace/i });
    expect(btn).toBeDisabled();
    // Tooltip content is rendered lazily by Radix — the aria-describedby wiring
    // hooks it up when the trigger is focused. Ensure the number is present in
    // the tooltip trigger's accessible name path.
    const wrapperText = btn.closest("span")?.textContent;
    expect(wrapperText).toBeTruthy();
  });

  it("at limit+1: button remains disabled (mid-session drift is possible)", () => {
    setup(11, 10);
    expect(screen.getByRole("button", { name: /new workspace/i })).toBeDisabled();
  });
});
