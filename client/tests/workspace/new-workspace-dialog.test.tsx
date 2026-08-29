import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
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

import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog";
import { ApiError } from "@/lib/api/errors";
import { makeApiMock } from "../helpers/api-mock";
import { renderWithProviders } from "../helpers/render";
import { makeWorkspace } from "../helpers/fixtures";

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = makeApiMock();
  const result = renderWithProviders(
    <NewWorkspaceDialog open onOpenChange={vi.fn()} />,
    { api, queryClient: qc },
  );
  return { qc, api, ...result };
}

describe("NewWorkspaceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a workspace and navigates to it on success", async () => {
    const { api } = setup();
    const created = makeWorkspace({ id: "ws-new", name: "Papers on RAG" });
    (api.POST as ReturnType<typeof vi.fn>).mockResolvedValueOnce(created);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Papers on RAG");
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(api.POST).toHaveBeenCalledWith(
      "/workspaces",
      expect.objectContaining({ body: { name: "Papers on RAG" } }),
    );
    expect(routerPush).toHaveBeenCalledWith("/workspaces/ws-new");
  });

  it("renders CONFLICT inline on the name field, not as a toast", async () => {
    const { api } = setup();
    (api.POST as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({
        code: "CONFLICT",
        message: "duplicate",
        status: 409,
        requestId: "req-1",
      }),
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Existing");
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    const err = await screen.findByRole("alert");
    expect(err.textContent).toMatch(/already exists/i);
    const input = screen.getByLabelText(/^name$/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("renders PLAN_LIMIT_EXCEEDED inline in the dialog, not as a toast", async () => {
    const { api } = setup();
    (api.POST as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "You've reached the FREE workspace cap.",
        status: 402,
        requestId: "req-2",
      }),
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Another");
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    const err = await screen.findByRole("alert");
    expect(err.textContent).toMatch(/FREE workspace cap/);
  });

  it("blocks empty submission with an inline error", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create workspace/i }));
    const err = await screen.findByRole("alert");
    expect(err.textContent).toMatch(/give the workspace a name/i);
  });
});
