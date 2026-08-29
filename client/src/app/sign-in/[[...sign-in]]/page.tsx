import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth/auth-frame";
import { authAppearance } from "@/lib/clerk-appearance";

export const metadata: Metadata = {
  title: "Sign in — RAG Notebook",
  description: "Sign in to your workspaces, sources, and chats.",
};

export default function SignInPage() {
  return (
    <AuthFrame
      headline="Your workspaces are where you left them."
      aside={
        <p>
          A workspace keeps its own sources and its own chat, and nothing moves
          between them. Sign in and pick up the one you were working in.
        </p>
      }
    >
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/app" appearance={authAppearance} />
    </AuthFrame>
  );
}
