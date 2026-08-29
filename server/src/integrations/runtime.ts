export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([fn(), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface BackoffPolicy {
  baseMs?: number;

  factor?: number;

  jitterRatio?: number;

  maxDelayMs?: number;
}

export interface RetryPolicy extends BackoffPolicy {
  label: string;

  maxAttempts: number;

  isRetryable(err: unknown): boolean;

  onRetry?(info: { attempt: number; delayMs: number; err: unknown }): void;
}

const BACKOFF_DEFAULTS = { baseMs: 500, factor: 2, jitterRatio: 0.25, maxDelayMs: 15_000 };

export function retryDelayMs(attempt: number, policy: BackoffPolicy = {}): number {
  const { baseMs, factor, jitterRatio, maxDelayMs } = { ...BACKOFF_DEFAULTS, ...policy };
  const base = baseMs * factor ** (attempt - 1);
  return Math.min(maxDelayMs, Math.round(base * (1 + Math.random() * jitterRatio)));
}

export async function withRetry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= policy.maxAttempts || !policy.isRetryable(err)) throw err;
      const delayMs = retryDelayMs(attempt, policy);
      policy.onRetry?.({ attempt, delayMs, err });
      await sleep(delayMs);
    }
  }
}
