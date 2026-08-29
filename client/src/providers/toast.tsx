"use client";

import { Toaster, toast as sonner } from "sonner";
import { isApiError, type ApiError } from "@/lib/api/errors";

/**
 * Toast surface. Wraps sonner and exposes helpers that render an ApiError with
 * its message and a "Copy request id" action. The request id is what turns a
 * support conversation from an hour into five minutes.
 */
export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg)]",
          actionButton: "bg-[var(--color-accent)] text-[var(--color-accent-fg)]",
        },
      }}
    />
  );
}

export const toast = {
  success: (message: string) => sonner.success(message),
  info: (message: string) => sonner.message(message),
  warning: (message: string) => sonner.warning(message),

  /** Render an error. Accepts an ApiError to surface code + request id, or a plain message. */
  error: (input: ApiError | string, title?: string) => {
    if (typeof input === "string") {
      sonner.error(title ?? input, title ? { description: input } : undefined);
      return;
    }
    const err = input;
    sonner.error(title ?? err.message, {
      description: `${err.code} · request ${err.requestId}`,
      action: {
        label: "Copy request id",
        onClick: () => {
          void navigator.clipboard.writeText(err.requestId);
        },
      },
      duration: 8_000,
    });
  },

  /** Type guard re-export so callers don't need two imports. */
  isApiError,
};
