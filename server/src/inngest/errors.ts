import { NonRetriableError } from 'inngest';

export type IngestionFailureCode =
  | 'NETWORK_ERROR'
  | 'UPSTREAM_5XX'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'UNSUPPORTED_CONTENT'
  | 'PARSE_FAILURE'
  | 'EXTRACTION_FAILED'
  | 'PDF_ENCRYPTED'
  | 'PDF_NO_TEXT_LAYER'
  | 'TRANSCRIPT_DISABLED'
  | 'CONTENT_TOO_LARGE'
  | 'ROBOTS_BLOCKED'
  | 'PERMISSION_DENIED'
  | 'TOKEN_QUOTA_EXCEEDED';

const TERMINAL_CODES: ReadonlySet<IngestionFailureCode> = new Set([
  'UNSUPPORTED_CONTENT',
  'PARSE_FAILURE',
  'EXTRACTION_FAILED',
  'PDF_ENCRYPTED',
  'PDF_NO_TEXT_LAYER',
  'TRANSCRIPT_DISABLED',
  'CONTENT_TOO_LARGE',
  'ROBOTS_BLOCKED',
  'PERMISSION_DENIED',
  'TOKEN_QUOTA_EXCEEDED',
]);

export function isRetryable(code: IngestionFailureCode): boolean {
  return !TERMINAL_CODES.has(code);
}

export class IngestionError extends Error {
  public override readonly name = 'IngestionError';
  public readonly failureCode: IngestionFailureCode;
  public readonly failureRetryable: boolean;

  constructor(code: IngestionFailureCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.failureCode = code;
    this.failureRetryable = isRetryable(code);
  }
}

export function throwIngestionError(
  code: IngestionFailureCode,
  message: string,
  options?: { cause?: unknown },
): never {
  const err = new IngestionError(code, message, options);
  if (!err.failureRetryable) {
    throw new NonRetriableError(message, { cause: err });
  }
  throw err;
}

export function coerceIngestionFailure(err: unknown): {
  code: IngestionFailureCode;
  message: string;
  retryable: boolean;
} {
  const found = findIngestionError(err);
  if (found) {
    return {
      code: found.failureCode,
      message: found.message,
      retryable: found.failureRetryable,
    };
  }
  const message = err instanceof Error ? err.message : 'Unknown ingestion failure';
  return { code: 'INTERNAL_ERROR', message, retryable: false };
}

function findIngestionError(err: unknown, depth = 0): IngestionError | null {
  if (depth > 6 || err === null || err === undefined) return null;
  if (err instanceof IngestionError) return err;
  if (typeof err === 'object' && 'cause' in err) {
    return findIngestionError(err.cause, depth + 1);
  }
  return null;
}
