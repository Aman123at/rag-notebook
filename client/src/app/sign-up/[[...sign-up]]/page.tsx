import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth/auth-frame";
import { authAppearance } from "@/lib/clerk-appearance";
import { limitsForPlan } from "@/lib/limits";

export const metadata: Metadata = {
  title: "Create your account — RAG Notebook",
  description:
    "Start free: workspaces, sources in each, and a million tokens without a card.",
};

const free = limitsForPlan("FREE");

function count(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString("en-US");
}

function tokens(n: number | null): string {
  if (n === null) return "Unlimited";
  return n >= 1_000_000 ? `${n / 1_000_000}M` : n.toLocaleString("en-US");
}

export default function SignUpPage() {
  return (
    <AuthFrame
      headline="Start a notebook you can check."
      aside={
        <p>
          The free plan is a plan, not a trial: {count(free.maxWorkspaces)}{" "}
          workspaces, {count(free.maxSourcesPerWorkspace)} sources in each, and{" "}
          {tokens(free.lifetimeTokens)} tokens, with no card. Every answer you
          get links back to the page or timestamp it came from.
        </p>
      }
    >
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/app" appearance={authAppearance} />
    </AuthFrame>
  );
}
