import { tavily, type TavilyClient } from '@tavily/core';

import { env } from '@/config/env.js';
import { logger } from '@/observability/logger.js';

import { withTimeout } from './runtime.js';

const TAVILY_TIMEOUT_MS = 8_000;
const TAVILY_MAX_RESULTS = 5;

let clientHandle: TavilyClient | undefined;

function getClient(): TavilyClient | null {
  if (clientHandle) return clientHandle;
  if (!env.TAVILY_API_KEY) return null;
  clientHandle = tavily({ apiKey: env.TAVILY_API_KEY });
  return clientHandle;
}

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface WebSearchOutcome {
  query: string;
  results: readonly WebSearchHit[];

  degraded: boolean;
}

export async function webSearch(query: string): Promise<WebSearchOutcome> {
  const client = getClient();
  if (!client) {
    logger.warn({ event: 'tavily.disabled' }, 'TAVILY_API_KEY not set — web_search returns empty');
    return { query, results: [], degraded: true };
  }
  try {
    const response = await withTimeout('tavily.search', TAVILY_TIMEOUT_MS, () =>
      client.search(query, {
        searchDepth: 'basic',
        maxResults: TAVILY_MAX_RESULTS,
        includeAnswer: false,
      }),
    );
    const results: WebSearchHit[] = response.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 400),
      score: r.score,
    }));
    return { query, results, degraded: false };
  } catch (err) {
    logger.warn(
      {
        event: 'tavily.search.failed',
        query,
        err: err instanceof Error ? err.message : String(err),
      },
      'Tavily web_search failed — degrading to empty result set',
    );
    return { query, results: [], degraded: true };
  }
}
