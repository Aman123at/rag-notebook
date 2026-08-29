"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ServiceAlert, RequestIdRow } from "@/components/ui/service-alert";
import { isApiError } from "@/lib/api/errors";

/**
 * Route-group boundary for signed-in screens. The shell above it survives, so
 * this is a disruption on one line rather than the whole network being down —
 * no mark, no page frame, and the rail is still there to travel elsewhere.
 */
export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const pathname = usePathname();
  const requestId = isApiError(error) ? error.requestId : (error.digest ?? "");
  const code = isApiError(error) ? error.code : null;
  const cause = error.message.trim();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ServiceAlert
        severity="down"
        status="Service disrupted"
        affected={[code, pathname].filter(Boolean).join(" · ")}
        heading="This screen didn’t load."
        headingAs="h2"
      >
        <p>{cause || "The screen threw an error before it could render."}</p>
        <p>
          Nothing was lost — your workspaces and sources are untouched. Retrying
          re-runs this screen only.
        </p>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Button type="button" onClick={reset}>
            Retry
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app">Back to chat</Link>
          </Button>
        </div>

        {requestId ? <RequestIdRow id={requestId} /> : null}
      </ServiceAlert>
    </div>
  );
}
