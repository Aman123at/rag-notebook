import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Show } from "@clerk/nextjs";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The primary call to action on the marketing pages. A signed-out visitor is
 * pushed to sign-up; a signed-in visitor already has an account, so the same
 * slot sends them into the app instead of asking them to sign up again.
 *
 * @param size - Button size, forwarded to `Button`.
 * @param withArrow - Whether to render the trailing arrow glyph.
 * @returns The auth-appropriate primary CTA button.
 */
export function PrimaryCta({
  size,
  withArrow = false,
}: {
  size?: ButtonProps["size"];
  withArrow?: boolean;
}) {
  const arrow = withArrow ? (
    <ArrowRight className="h-4 w-4" aria-hidden="true" />
  ) : null;

  return (
    <>
      <Show when="signed-out">
        <Button asChild {...(size ? { size } : {})}>
          <Link href="/sign-up">
            Start free
            {arrow}
          </Link>
        </Button>
      </Show>
      <Show when="signed-in">
        <Button asChild {...(size ? { size } : {})}>
          <Link href="/app">
            Open your workspace
            {arrow}
          </Link>
        </Button>
      </Show>
    </>
  );
}
