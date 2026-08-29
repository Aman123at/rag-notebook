import { FirecrawlClient, SdkError } from '@mendable/firecrawl-js';

import { env } from '@/config/env.js';
import { throwIngestionError } from '@/inngest/errors.js';

const SCRAPE_TIMEOUT_MS = 30_000;

let client: FirecrawlClient | null = null;

function getClient(): FirecrawlClient {
  if (client) return client;
  if (!env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured; WEB_URL extraction unavailable.');
  }
  client = new FirecrawlClient({ apiKey: env.FIRECRAWL_API_KEY });
  return client;
}

export interface FirecrawlScrapeResult {
  markdown: string;
  title: string | null;
  description: string | null;
  language: string | null;
  finalUrl: string;
  scrapedAt: string;
}

export async function scrapeUrlAsMarkdown(url: string): Promise<FirecrawlScrapeResult> {
  const c = getClient();
  const scrapedAt = new Date().toISOString();
  let doc;
  try {
    doc = await c.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: SCRAPE_TIMEOUT_MS,
      blockAds: true,
    });
  } catch (err) {
    handleFirecrawlError(err, url);
  }
  const markdown = doc.markdown?.trim();
  const status = doc.metadata?.statusCode;
  const metaError = doc.metadata?.error;
  if (!markdown || markdown.length === 0) {
    if (metaError && /robots/i.test(metaError)) {
      throwIngestionError('ROBOTS_BLOCKED', `robots.txt disallows: ${url}`);
    }
    if (typeof status === 'number' && status === 404) {
      throwIngestionError('EXTRACTION_FAILED', `Upstream 404 for ${url}.`);
    }
    throwIngestionError('EXTRACTION_FAILED', `Firecrawl returned no markdown for ${url}.`);
  }
  return {
    markdown,
    title: doc.metadata?.title ?? null,
    description: doc.metadata?.description ?? null,
    language: doc.metadata?.language ?? null,
    finalUrl: doc.metadata?.url ?? url,
    scrapedAt,
  };
}

function handleFirecrawlError(err: unknown, url: string): never {
  if (err instanceof SdkError) {
    const status = err.status ?? 0;
    if (status === 429) {
      throwIngestionError('RATE_LIMITED', `Firecrawl rate-limited on ${url}.`, { cause: err });
    }
    if (status >= 500 && status < 600) {
      throwIngestionError('UPSTREAM_5XX', `Firecrawl 5xx (${status}) on ${url}.`, { cause: err });
    }
    if (status === 404) {
      throwIngestionError('EXTRACTION_FAILED', `URL not found: ${url}.`, { cause: err });
    }
    if (status === 403 && /robots/i.test(err.message)) {
      throwIngestionError('ROBOTS_BLOCKED', `robots.txt disallows: ${url}.`, { cause: err });
    }
    if (status >= 400 && status < 500) {
      throwIngestionError('EXTRACTION_FAILED', `Firecrawl ${status} on ${url}.`, { cause: err });
    }
  }
  if (err instanceof Error && /timeout|ETIMEDOUT|ECONNRESET|ENETUNREACH/i.test(err.message)) {
    throwIngestionError('NETWORK_ERROR', `Firecrawl network error on ${url}.`, { cause: err });
  }
  throwIngestionError(
    'EXTRACTION_FAILED',
    err instanceof Error ? err.message : `Unknown Firecrawl error on ${url}.`,
    { cause: err },
  );
}

export function __setFirecrawlClientForTests(fake: FirecrawlClient | null): void {
  client = fake;
}
