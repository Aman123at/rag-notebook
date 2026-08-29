import { vi } from "vitest";

/**
 * Mock next/navigation for component tests. The workspace components use
 * `useParams`, `useRouter`, `usePathname`, and `notFound`.
 */
export const routerPush = vi.fn<(href: string) => void>();
export const routerReplace = vi.fn<(href: string) => void>();

export function installRouterMock(overrides: {
  params?: Record<string, string>;
  pathname?: string;
} = {}) {
  vi.mock("next/navigation", async () => ({
    useRouter: () => ({
      push: routerPush,
      replace: routerReplace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    useParams: () => overrides.params ?? {},
    usePathname: () => overrides.pathname ?? "/",
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  }));
}
