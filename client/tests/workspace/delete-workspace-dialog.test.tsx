import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerPush = vi.fn<(href: string) => void>();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
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

import { DeleteWorkspaceDialog } from "@/components/workspace/delete-workspace-dialog";
import { WORKSPACES_QUERY_KEY, type Workspace } from "@/hooks/use-workspaces";
import { ApiError } from "@/lib/api/errors";
import { makeApiMock } from "../helpers/api-mock";
import { renderWithProviders } from "../helpers/render";
import { makeWorkspace } from "../helpers/fixtures";

function setup(workspaceOverride: Partial<Workspace> = {}) {
  const workspace = makeWorkspace({ id: "ws-d1", name: "Trash me", sourceCount: 4, ...workspaceOverride });
  const others = [makeWorkspace(), makeWorkspace()];
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, [workspace, ...others]);
  const api = makeApiMock();
  // The dialog reads the chat count from `meta.total` via api.LIST.
  (api.LIST as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [],
    meta: { total: 2 },
  });
  const result = renderWithProviders(
    <DeleteWorkspaceDialog workspace={workspace} open onOpenChange={vi.fn()} />,
    { api, queryClient: qc },
  );
  return { workspace, qc, api, ...result };
}

describe("DeleteWorkspaceDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names the sources and chats that will be lost", async () => {
    setup({ sourceCount: 4 });
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(dialog.textContent).toMatch(/4 sources and 2 chats/);
    });
  });

  it("optimistically removes the workspace from the cached list", async () => {
    const { qc, api } = setup();
    (api.DELETE as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "ws-d1",
      deleted: true,
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /delete workspace/i }));

    await waitFor(() => {
      const cached = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      expect(cached?.some((w) => w.id === "ws-d1")).toBe(false);
    });
  });

  it("rolls back when the server rejects the delete", async () => {
    const { qc, api } = setup();
    (api.DELETE as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ code: "FORBIDDEN", message: "nope", status: 403, requestId: "r-1" }),
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /delete workspace/i }));

    await waitFor(() => {
      const cached = qc.getQueryData<Workspace[]>(WORKSPACES_QUERY_KEY);
      expect(cached?.some((w) => w.id === "ws-d1")).toBe(true);
    });
  });
});
