"use client";

import * as React from "react";
import { Globe, X } from "lucide-react";
import { OFF_NETWORK_STYLE } from "@/lib/lines";
import type { WebSearchOfferState } from "@/interfaces/chats.interface";

interface Props {
  offer: WebSearchOfferState;
  onAccept: () => void;
  onDecline: () => void;
  disabled?: boolean;
}

/**
 * The confirm/decline control for a `web_search_offer` (contract v1.3.0).
 *
 * The assistant's question already streamed as ordinary text above this —
 * this is the affordance, not a restatement of it. Typing "yes" works just
 * as well (the server reads free-text consent), so this is a shortcut, and
 * declining is purely local: an offer expires on its own as soon as the
 * next message lands, so "No thanks" just dismisses the card.
 *
 * The remaining-searches count is shown because the allowance is small (5
 * per chat) and spending one is the user's decision to make informed.
 */
export function WebSearchOffer({ offer, onAccept, onDecline, disabled = false }: Props) {
  return (
    <div
      role="group"
      aria-label="Search the web for this question"
      style={OFF_NETWORK_STYLE}
      className="route-spine rounded-[var(--radius-chassis)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-well)] py-2.5 pr-3"
      data-offnet="true"
    >
      <p className="label-track mb-2 text-[var(--color-offnet)]">Leaves your sources</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className="label-track inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-line-cobalt-text)] px-2.5 py-1 text-[var(--color-line-cobalt-text)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-line-cobalt-text)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Globe className="h-3 w-3" aria-hidden />
          Search the web
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={disabled}
          className="label-track inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] px-2.5 py-1 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3 w-3" aria-hidden />
          No thanks
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
        Searches the public web for{" "}
        <span className="font-mono text-[var(--color-fg)]">&ldquo;{offer.query}&rdquo;</span>.
        Results are used for this answer only — they are not added to your sources.{" "}
        {offer.remainingSearches} web{" "}
        {offer.remainingSearches === 1 ? "search" : "searches"} left in this chat.
      </p>
    </div>
  );
}
