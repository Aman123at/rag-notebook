import { NonRetriableError } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IngestionError } from '../src/inngest/errors.js';
import { fetchCaptionCues, isBotCheck } from '../src/integrations/youtube-captions.js';
import { __setYouTubeClientForTests, fetchYouTubeVideo } from '../src/integrations/youtube.js';

/** The exact reason string YouTube sends — note U+2019, not an ASCII apostrophe. */
const BOT_REASON = 'Sign in to confirm you’re not a bot';

function playerResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubPlayer(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(playerResponse(body))),
  );
}

function stubMetadata(): void {
  __setYouTubeClientForTests({
    videos: {
      list: () =>
        Promise.resolve({
          data: {
            items: [
              {
                snippet: { title: 'Sample', channelId: 'c1', channelTitle: 'Chan' },
                contentDetails: { duration: 'PT10M' },
                status: { privacyStatus: 'public' },
              },
            ],
          },
        }),
    },
  } as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
  __setYouTubeClientForTests(null);
});

describe('isBotCheck', () => {
  it('recognises the bot check despite the curly apostrophe', () => {
    expect(isBotCheck(BOT_REASON)).toBe(true);
    expect(isBotCheck("Sign in to confirm you're not a bot")).toBe(true);
  });

  it('does not mistake a genuine age gate for a bot check', () => {
    expect(isBotCheck('Sign in to confirm your age')).toBe(false);
    expect(isBotCheck('This video is available to this channel’s members')).toBe(false);
    expect(isBotCheck('')).toBe(false);
  });
});

describe('fetchCaptionCues', () => {
  it('reports BOT_CHECK, not LOGIN_REQUIRED, when every client is bot-checked', async () => {
    stubPlayer({ playabilityStatus: { status: 'LOGIN_REQUIRED', reason: BOT_REASON } });
    const outcome = await fetchCaptionCues('v4F1gFy-hqg');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('BOT_CHECK');
  });

  it('still reports LOGIN_REQUIRED for a real sign-in gate', async () => {
    stubPlayer({
      playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm your age' },
    });
    const outcome = await fetchCaptionCues('someVideoId');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('LOGIN_REQUIRED');
  });
});

describe('fetchYouTubeVideo bot-check classification', () => {
  it('raises a RETRYABLE error so Inngest tries again', async () => {
    stubMetadata();
    stubPlayer({ playabilityStatus: { status: 'LOGIN_REQUIRED', reason: BOT_REASON } });

    const err = await fetchYouTubeVideo('v4F1gFy-hqg').catch((e: unknown) => e);

    // The production bug: this arrived as a NonRetriableError PERMISSION_DENIED
    // reading "requires sign-in (age-restricted or members-only)".
    expect(err).not.toBeInstanceOf(NonRetriableError);
    expect(err).toBeInstanceOf(IngestionError);
    const ingestion = err as IngestionError;
    expect(ingestion.failureCode).toBe('RATE_LIMITED');
    expect(ingestion.failureRetryable).toBe(true);
    expect(ingestion.message).not.toMatch(/age-restricted|members-only/);
    expect(ingestion.message).toMatch(/bot check/i);
  });

  it('still raises a TERMINAL error for a genuinely age-gated video', async () => {
    stubMetadata();
    stubPlayer({
      playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm your age' },
    });

    const err = await fetchYouTubeVideo('ageGated123').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NonRetriableError);
    expect((err as Error).message).toMatch(/age-restricted or members-only/);
  });
});
