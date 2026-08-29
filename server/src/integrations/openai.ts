import OpenAI from 'openai';

import { env } from '@/config/env.js';
import { EMBEDDING } from '@/contract/index.js';
import { throwIngestionError } from '@/inngest/errors.js';
import { logger } from '@/observability/logger.js';

import { withRetry } from './runtime.js';

export const EMBEDDING_LIMITS = Object.freeze({
  maxTokensPerInput: 8_192,
  maxTotalTokensPerRequest: 285_000,
  maxInputsPerRequest: 2_000,
});

const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 500;
const RETRY_MAX_DELAY_MS = 15_000;

let clientHandle: OpenAI | undefined;

function getClient(): OpenAI {
  if (clientHandle) return clientHandle;
  if (!env.OPENAI_API_KEY) {
    throwIngestionError(
      'INTERNAL_ERROR',
      'OPENAI_API_KEY is not configured but ingestion attempted to embed.',
    );
  }
  clientHandle = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000 });
  return clientHandle;
}

export function estimateEmbeddingTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil((text.length / 4) * 1.15));
}

export function packEmbeddingBatches(inputs: readonly string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const input of inputs) {
    const tokens = estimateEmbeddingTokens(input);
    if (tokens > EMBEDDING_LIMITS.maxTokensPerInput) {
      throwIngestionError(
        'CONTENT_TOO_LARGE',
        `Chunk of ~${tokens} tokens exceeds embedding input cap ${EMBEDDING_LIMITS.maxTokensPerInput}.`,
      );
    }
    const wouldExceedTokens = currentTokens + tokens > EMBEDDING_LIMITS.maxTotalTokensPerRequest;
    const wouldExceedCount = current.length + 1 > EMBEDDING_LIMITS.maxInputsPerRequest;
    if (current.length > 0 && (wouldExceedTokens || wouldExceedCount)) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(input);
    currentTokens += tokens;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export interface EmbeddingBatch {
  vectors: number[][];

  usageTokens: number;
}

export async function embedBatch(
  inputs: readonly string[],
  opts?: { model?: string },
): Promise<EmbeddingBatch> {
  if (inputs.length === 0) return { vectors: [], usageTokens: 0 };
  const client = getClient();
  const model = opts?.model ?? env.EMBEDDING_MODEL;

  try {
    return await withRetry(
      async () => {
        const response = await client.embeddings.create({
          model,
          input: [...inputs],
          dimensions: EMBEDDING.EMBEDDING_DIMENSIONS,
        });
        const vectors = response.data
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((row) => row.embedding);
        if (vectors.length !== inputs.length) {
          throwIngestionError(
            'INTERNAL_ERROR',
            `OpenAI returned ${vectors.length} embeddings for ${inputs.length} inputs.`,
          );
        }
        return { vectors, usageTokens: response.usage.prompt_tokens };
      },
      {
        label: 'openai.embed',
        maxAttempts: RETRY_MAX_ATTEMPTS,
        baseMs: RETRY_BASE_MS,
        maxDelayMs: RETRY_MAX_DELAY_MS,
        isRetryable: (err) => classifyError(err).retryable,
        onRetry: ({ attempt, delayMs, err }) => {
          const classified = classifyError(err);
          logger.warn(
            {
              event: 'openai.embed.retry',
              attempt,
              delayMs,
              reason: classified.code,
              message: classified.message,
            },
            'Retrying OpenAI embeddings.create after a retryable failure',
          );
        },
      },
    );
  } catch (err) {
    const classified = classifyError(err);
    if (classified.code === 'RATE_LIMITED') {
      throwIngestionError('RATE_LIMITED', classified.message, { cause: err });
    }
    if (classified.code === 'UPSTREAM_5XX') {
      throwIngestionError('UPSTREAM_5XX', classified.message, { cause: err });
    }
    if (classified.code === 'CONTENT_TOO_LARGE') {
      throwIngestionError('CONTENT_TOO_LARGE', classified.message, { cause: err });
    }
    throwIngestionError('INTERNAL_ERROR', classified.message, { cause: err });
  }
}

function classifyError(err: unknown): {
  code: 'RATE_LIMITED' | 'UPSTREAM_5XX' | 'CONTENT_TOO_LARGE' | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
} {
  if (err instanceof OpenAI.RateLimitError) {
    return { code: 'RATE_LIMITED', message: err.message, retryable: true };
  }
  if (err instanceof OpenAI.InternalServerError) {
    return { code: 'UPSTREAM_5XX', message: err.message, retryable: true };
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { code: 'UPSTREAM_5XX', message: err.message, retryable: true };
  }
  if (err instanceof OpenAI.BadRequestError) {
    return { code: 'CONTENT_TOO_LARGE', message: err.message, retryable: false };
  }
  if (err instanceof OpenAI.APIError) {
    return { code: 'INTERNAL_ERROR', message: err.message, retryable: false };
  }
  if (err instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: err.message, retryable: false };
  }
  return { code: 'INTERNAL_ERROR', message: 'Unknown OpenAI error', retryable: false };
}

import type OpenAINS from 'openai';

import { type ChatObservability, observedChatClient } from '@/integrations/langfuse.js';
type ChatMessage = OpenAINS.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAINS.Chat.Completions.ChatCompletionTool;
type ChatCompletion = OpenAINS.Chat.Completions.ChatCompletion;
type ChatChunk = OpenAINS.Chat.Completions.ChatCompletionChunk;

export interface StreamChatOptions {
  model: string;
  messages: readonly ChatMessage[];
  tools?: readonly ChatTool[];
  toolChoice?: 'auto' | 'none';
  maxCompletionTokens?: number;
  temperature?: number;

  signal?: AbortSignal;
  observability?: ChatObservability;
}

export async function streamChat(opts: StreamChatOptions): Promise<AsyncIterable<ChatChunk>> {
  const client = opts.observability
    ? observedChatClient(getClient(), opts.observability)
    : getClient();
  const requestOpts = opts.signal ? { signal: opts.signal } : undefined;
  const stream = await client.chat.completions.create(
    {
      model: opts.model,
      messages: [...opts.messages],
      stream: true,
      stream_options: { include_usage: true },
      ...(opts.tools ? { tools: [...opts.tools], tool_choice: opts.toolChoice ?? 'auto' } : {}),
      ...(opts.maxCompletionTokens !== undefined
        ? { max_completion_tokens: opts.maxCompletionTokens }
        : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
    requestOpts,
  );
  return stream;
}

export interface CompleteChatOptions {
  model: string;
  messages: readonly ChatMessage[];
  responseFormat?: { type: 'json_object' };
  maxCompletionTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  observability?: ChatObservability;
}

export async function completeChat(opts: CompleteChatOptions): Promise<ChatCompletion> {
  const client = opts.observability
    ? observedChatClient(getClient(), opts.observability)
    : getClient();
  const requestOpts = opts.signal ? { signal: opts.signal } : undefined;
  return client.chat.completions.create(
    {
      model: opts.model,
      messages: [...opts.messages],
      stream: false,
      ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
      ...(opts.maxCompletionTokens !== undefined
        ? { max_completion_tokens: opts.maxCompletionTokens }
        : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
    requestOpts,
  );
}
