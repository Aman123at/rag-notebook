"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Roundel } from "@/components/ui/roundel";
import { ServiceAlert, RequestIdRow } from "@/components/ui/service-alert";
import { isApiError } from "@/lib/api/errors";

/**
 * Root error boundary — the whole page below the layout has failed, so this
 * screen has to carry the network mark itself and offer its own way back.
 *
 * The alert reports what a board reports: severity, the route affected, the
 * cause in plain words, the recovery, and the request id support will ask for.
 */
export default function RootError({
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
    <main id="main" className="relative flex min-h-screen items-center px-4 py-16 sm:px-6">
      <div aria-hidden className="enamel-watermark pointer-events-none absolute inset-0" />

      <div className="relative mx-auto w-full max-w-xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]"
        >
          <Roundel size={24} className="text-[var(--color-line-cobalt-text)]" />
          RAG Notebook
        </Link>

        <ServiceAlert
          severity="down"
          status="Service disrupted"
          affected={[code, pathname].filter(Boolean).join(" · ")}
          heading="This screen didn’t load."
        >
          <p>{cause || "The page threw an error before it could render."}</p>
          <p>
            {requestId
              ? "Trying again re-runs the screen. If it fails a second time, send support the request id below — it identifies this exact failure in the server logs."
              : "Trying again re-runs the screen. This failure carries no request id, so if it keeps happening, tell support which page you were on and what you were doing."}
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Back to the start</Link>
            </Button>
          </div>

          {requestId ? <RequestIdRow id={requestId} /> : null}
        </ServiceAlert>
      </div>
    </main>
  );
}
