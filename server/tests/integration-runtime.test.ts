import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook';

const { retryDelayMs, sleep, withRetry, withTimeout } =
  await import('../src/integrations/runtime.js');

describe('withTimeout', () => {
  it('resolves with the value when the call finishes in time', async () => {
    await expect(withTimeout('svc.op', 1_000, () => Promise.resolve(7))).resolves.toBe(7);
  });

  it('rejects with the label and budget once the deadline passes', async () => {
    vi.useFakeTimers();
    try {
      const p = withTimeout('mem0.search', 4_000, () => new Promise(() => undefined));
      const assertion = expect(p).rejects.toThrow('mem0.search timed out after 4000ms');
      await vi.advanceTimersByTimeAsync(4_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rethrows the original error object, not a copy', async () => {
    const original = Object.assign(new Error('forbidden'), {
      code: 403,
      response: { status: 403 },
    });
    await expect(withTimeout('yt.videos.list', 1_000, () => Promise.reject(original))).rejects.toBe(
      original,
    );
  });

  it('rethrows a non-Error rejection unchanged', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const rejectWithString = () => Promise.reject('plain string');
    await expect(withTimeout('svc.op', 1_000, rejectWithString)).rejects.toBe('plain string');
  });

  it('clears its timer so a resolved call leaves nothing pending', async () => {
    vi.useFakeTimers();
    try {
      await withTimeout('svc.op', 60_000, () => Promise.resolve('ok'));
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears its timer after a rejection too', async () => {
    vi.useFakeTimers();
    try {
      await expect(
        withTimeout('svc.op', 60_000, () => Promise.reject(new Error('nope'))),
      ).rejects.toThrow('nope');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('retryDelayMs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reproduces OpenAI's exponential curve with 25% jitter", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const policy = { baseMs: 500, factor: 2, jitterRatio: 0.25, maxDelayMs: 15_000 };
    expect(retryDelayMs(1, policy)).toBe(500);
    expect(retryDelayMs(2, policy)).toBe(1_000);
    expect(retryDelayMs(3, policy)).toBe(2_000);
    expect(retryDelayMs(4, policy)).toBe(4_000);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(retryDelayMs(1, policy)).toBe(625);
    expect(retryDelayMs(2, policy)).toBe(1_250);
  });

  it('caps the delay at maxDelayMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const policy = { baseMs: 500, factor: 2, jitterRatio: 0.25, maxDelayMs: 15_000 };
    expect(retryDelayMs(20, policy)).toBe(15_000);
  });

  it("reproduces Cloudinary's flat 200ms + up to 300ms jitter", () => {
    const policy = { baseMs: 200, factor: 1, jitterRatio: 1.5, maxDelayMs: 15_000 };
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(retryDelayMs(1, policy)).toBe(200);
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(retryDelayMs(1, policy)).toBe(500);
  });
});

describe('withRetry', () => {
  const alwaysRetryable = () => true;

  it('returns the first success without sleeping', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    const onRetry = vi.fn();
    await expect(
      withRetry(fn, { label: 'svc.op', maxAttempts: 5, isRetryable: alwaysRetryable, onRetry }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries a retryable failure and succeeds on the next attempt', async () => {
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve('ok');
    });
    const onRetry = vi.fn();

    await expect(
      withRetry(fn, {
        label: 'svc.op',
        maxAttempts: 5,
        isRetryable: alwaysRetryable,
        baseMs: 0,
        onRetry,
      }),
    ).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toMatchObject({ attempt: 1 });
  });

  it('never retries a failure the policy calls terminal', async () => {
    const authFailure = Object.assign(new Error('unauthorized'), { status: 401 });
    const fn = vi.fn(() => Promise.reject(authFailure));

    await expect(
      withRetry(fn, {
        label: 'svc.op',
        maxAttempts: 5,
        baseMs: 0,

        isRetryable: (err) => ![401, 403, 404].includes((err as { status?: number }).status ?? 0),
      }),
    ).rejects.toBe(authFailure);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const last = new Error('attempt 3');
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      return Promise.reject(calls === 3 ? last : new Error(`attempt ${calls}`));
    });

    await expect(
      withRetry(fn, {
        label: 'svc.op',
        maxAttempts: 3,
        isRetryable: alwaysRetryable,
        baseMs: 0,
      }),
    ).rejects.toBe(last);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('makes exactly one extra attempt when maxAttempts is 2', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('down')));
    await expect(
      withRetry(fn, {
        label: 'svc.op',
        maxAttempts: 2,
        isRetryable: alwaysRetryable,
        baseMs: 0,
      }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry at all when maxAttempts is 1', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('down')));
    await expect(
      withRetry(fn, { label: 'svc.op', maxAttempts: 1, isRetryable: alwaysRetryable }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once the delay has elapsed', async () => {
    let done = false;
    const p = sleep(500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});
