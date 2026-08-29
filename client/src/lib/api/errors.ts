import type { ApiErrorPayload, ErrorCode } from "./types";

export class ApiError extends Error {
  readonly code: ErrorCode | "UNKNOWN";
  readonly status: number;
  readonly requestId: string;
  readonly details: unknown;

  constructor(args: {
    code: ErrorCode | "UNKNOWN";
    message: string;
    status: number;
    requestId: string;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.status = args.status;
    this.requestId = args.requestId;
    this.details = args.details;
  }

  /** Build one from a parsed error envelope returned by the server. */
  static fromEnvelope(
    envelope: { error: ApiErrorPayload } | ApiErrorPayload | unknown,
    status: number,
    fallbackRequestId: string,
  ): ApiError {
    const payload = extractErrorPayload(envelope);
    if (payload) {
      return new ApiError({
        code: payload.code,
        message: payload.message,
        status,
        requestId: payload.requestId || fallbackRequestId,
        details: payload.details,
      });
    }
    return ApiError.unknown(status, fallbackRequestId);
  }

  /** Fallback for a non-2xx that did not return a parseable ApiError envelope. */
  static unknown(status: number, requestId: string): ApiError {
    return new ApiError({
      code: "UNKNOWN",
      message: `Request failed (${status})`,
      status,
      requestId,
    });
  }

  /** Fallback for a fetch that never produced a response (network / abort). */
  static network(cause: unknown, requestId: string): ApiError {
    const message = cause instanceof Error ? cause.message : "Network request failed";
    return new ApiError({ code: "UNKNOWN", message, status: 0, requestId, details: cause });
  }
}

function extractErrorPayload(value: unknown): ApiErrorPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const maybeEnvelope = value as { error?: unknown };
  const inner =
    typeof maybeEnvelope.error === "object" && maybeEnvelope.error !== null
      ? maybeEnvelope.error
      : value;
  const obj = inner as Record<string, unknown>;
  if (typeof obj.code === "string" && typeof obj.message === "string") {
    return {
      code: obj.code as ErrorCode,
      message: obj.message,
      requestId: typeof obj.requestId === "string" ? obj.requestId : "",
      details: obj.details,
    };
  }
  return null;
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
