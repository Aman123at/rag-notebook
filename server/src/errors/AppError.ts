import { ERROR_STATUS, type ErrorCode } from '@/contract/index.js';

export class AppError extends Error {
  public override readonly name = 'AppError';
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details: unknown;

  public readonly exposeDetails: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown; exposeDetails?: boolean },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = options?.details;
    this.exposeDetails = options?.exposeDetails ?? true;
  }
}

export function isAppError(err: unknown): err is AppError {
  if (err === null || typeof err !== 'object') return false;
  const record = err as Record<string, unknown>;
  return (
    record['name'] === 'AppError' &&
    typeof record['code'] === 'string' &&
    typeof record['status'] === 'number' &&
    typeof record['message'] === 'string'
  );
}

export class ContractViolationError extends Error {
  public override readonly name = 'ContractViolationError';
  public readonly routeKey: string;
  public readonly issues: unknown;
  constructor(routeKey: string, issues: unknown) {
    super(
      `Contract violation on route ${routeKey}: handler return does not match the response schema. ` +
        'Run pnpm contract:check or inspect issues on the thrown error for the specifics.',
    );
    this.routeKey = routeKey;
    this.issues = issues;
  }
}
