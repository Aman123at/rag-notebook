import { type WebSearchMode } from '@/retrieval/index.js';

import { isAffirmative, readTurnMetadata, type TurnMetadata } from '../consent.js';

export interface WebSearchStanceInput {
  requested: boolean;

  content: string;

  pendingOffer: { query: string } | undefined;

  searchesRemaining: number;

  retrievalUnavailable: boolean;
}

export interface WebSearchStance {
  mode: WebSearchMode;

  acceptedOffer: boolean;
}

export function decideWebSearchStance(input: WebSearchStanceInput): WebSearchStance {
  const acceptedOffer =
    input.pendingOffer !== undefined && (input.requested || isAffirmative(input.content));

  if (acceptedOffer || input.requested) {
    return {
      acceptedOffer,
      mode: input.searchesRemaining === 0 ? 'exhausted' : acceptedOffer ? 'answering' : 'enabled',
    };
  }
  if (!input.retrievalUnavailable && input.searchesRemaining > 0) {
    return { acceptedOffer, mode: 'offer' };
  }
  return { acceptedOffer, mode: 'off' };
}

export function findLastAssistantMetadata(
  history: readonly { id: string; role: string; metadata: unknown }[],
  excludeId: string,
): TurnMetadata {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i];
    if (!m || m.role !== 'assistant' || m.id === excludeId) continue;
    return readTurnMetadata(m.metadata);
  }
  return {};
}

export function parseToolQuery(argsBuffer: string): string {
  try {
    const parsed = JSON.parse(argsBuffer || '{}') as { query?: unknown };
    return typeof parsed.query === 'string' ? parsed.query.trim().slice(0, 400) : '';
  } catch {
    return '';
  }
}
