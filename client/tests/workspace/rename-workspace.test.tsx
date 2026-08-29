import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { WorkspaceItem } from "@/components/workspace/workspace-item";
import { WORKSPACES_QUERY_KEY, type Workspace } from "@/hooks/use-workspaces";
import { ApiError } from "@/lib/api/errors";
import { makeApiMock } from "../helpers/api-mock";
import { renderWithProviders } from "../helpers/render";
import { makeWorkspace } from "../helpers/fixtures";

function setup(workspace: Workspace) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, [workspace]);
  const api = makeApiMock();
  const result = renderWithProviders(
    <WorkspaceItem workspace={workspace} isActive={false} sourceCap={7} />,
    { api, queryClient: qc },
  );
  return { qc, api, ...result };
}

describe("Workspace rename", () => {
  beforeEach(() => vi.clearAllMocks());

  it("optimistically updates the cache on rename", async () => {
    const ws = makeWorkspace({ id: "ws-r1", name: "Old name" });
    const { qc, api } = setup(ws);
    (api.PATCH as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...ws,
      name: "New name",
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /rename Old name/i }));
    const input = await screen.findByLabelText(/workspace name/i);
    await user.clear(input);
    await user.type(input, "New name");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const cached = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      expect(cached?.[0]?.name).toBe("New name");
    });
    expect(api.PATCH).toHaveBeenCalledWith(
      "/workspaces/{workspaceId}",
      expect.objectContaining({
        params: { path: { workspaceId: "ws-r1" } },
        body: { name: "New name" },
      }),
    );
  });

  it("rolls back the optimistic update when the server fails", async () => {
    const ws = makeWorkspace({ id: "ws-r2", name: "Original" });
    const { qc, api } = setup(ws);
    (api.PATCH as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL_ERROR", message: "boom", status: 500, requestId: "r-1" }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /rename Original/i }));
    const input = await screen.findByLabelText(/workspace name/i);
    await user.clear(input);
    await user.type(input, "Attempt");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const cached = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      expect(cached?.[0]?.name).toBe("Original");
    });
  });

  it("renders CONFLICT inline on the name field, not as a toast", async () => {
    const ws = makeWorkspace({ id: "ws-r3", name: "First" });
    const { api } = setup(ws);
    (api.PATCH as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({
        code: "CONFLICT",
        message: "duplicate",
        status: 409,
        requestId: "r-2",
      }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /rename First/i }));
    const input = await screen.findByLabelText(/workspace name/i);
    await user.clear(input);
    await user.type(input, "Existing");
    await user.keyboard("{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already exists/i);
  });
});
