import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Clerk is app-wide infrastructure: `<ClerkProvider>` lives in the root
 * layout, so any component tree rendered in isolation is "outside" it and
 * Clerk's hooks throw. Mock it once here rather than in every suite —
 * tests assert our behaviour, not Clerk's.
 *
 * The default is a signed-in user, which is the state every authenticated
 * screen under test assumes. A suite that needs the signed-out branch can
 * override with its own `vi.mock("@clerk/nextjs", …)`.
 */
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "user_test",
    getToken: async () => "test-token",
  }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_test", fullName: "Test User" },
  }),
}));

afterEach(() => {
  cleanup();
});
