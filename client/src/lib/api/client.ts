/**
 * Typed API client, generic over the vendored contract paths.
 * Wraps `openapi-fetch` with three additions:
 *   1. request middleware attaches the Clerk token, `X-Contract-Version`, and `x-request-id`;
 *   2. `.data` from openapi-fetch (which is the `{ data, meta? }` envelope) is unwrapped to `data`;
 *   3. failures throw a typed `ApiError` instead of being returned as a `{ error }` union.
 *
 * The client never introduces per-endpoint methods — every route in `paths` is callable through
 * `GET`/`POST`/`PATCH`/`DELETE`, and TypeScript enforces the correct params, body, and response
 * type per route directly from the vendored `types.d.ts`.
 */
import createClient, {
  type Client,
} from "openapi-fetch";
import type { paths } from "@/contract/types";
import type { ContractGapPaths } from "./contract-gaps";
import { env } from "@/lib/env";
import { generateRequestId } from "@/lib/utils";
import { ApiError } from "./errors";
import type { ListResult, SuccessEnvelope } from "./types";
import type { Api } from "@/interfaces/api.interface";
import type { GetToken } from "@/types/api.types";

export type { GetToken } from "@/types/api.types";
export type { Api } from "@/interfaces/api.interface";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Build a raw openapi-fetch client wired with our auth + tracing middleware.
 *
 * Generic over the paths object so the contract-gap client (the two routes the
 * vendored types get wrong) is built by this same function and therefore
 * carries the same auth header, contract-version header and request id. There
 * is one place in the app that attaches those; this is it.
 */
function baseClient<TPaths extends object>(getToken: GetToken): Client<TPaths> {
  const raw = createClient<TPaths>({ baseUrl: env.NEXT_PUBLIC_API_URL });

  raw.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      request.headers.set("X-Contract-Version", env.NEXT_PUBLIC_CONTRACT_VERSION);
      if (!request.headers.has(REQUEST_ID_HEADER)) {
        request.headers.set(REQUEST_ID_HEADER, generateRequestId());
      }
      return request;
    },
    onResponse({ response }) {
      warnOnContractDrift(response.headers.get(CONTRACT_VERSION_HEADER));
      return response;
    },
  });

  return raw;
}

const CONTRACT_VERSION_HEADER = "X-Contract-Version";

/** Warn at most once per page load, however many requests drift. */
let driftWarned = false;

/**
 * §4.4 drift detection. Every response carries the contract version the
 * server speaks; compare it to the version this bundle was built against
 * and warn on a **major** mismatch. Never hard-fails — a client that
 * refuses to run on a minor bump is worse than one that logs.
 *
 * @param serverVersion - Value of the `X-Contract-Version` response header,
 *   or `null` when the server did not send one.
 */
export function warnOnContractDrift(serverVersion: string | null): void {
  if (driftWarned || serverVersion === null) return;
  const client = env.NEXT_PUBLIC_CONTRACT_VERSION;
  if (serverVersion === client) return;
  const serverMajor = serverVersion.split(".")[0];
  const clientMajor = client.split(".")[0];
  if (serverMajor === clientMajor) return;
  driftWarned = true;
  console.warn(
    `[contract-drift] This client is built against contract v${client} but the ` +
      `server speaks v${serverVersion}. Major versions differ — request and ` +
      `response shapes may not match. Rebuild the client against the current ` +
      `contract drop.`,
  );
}

interface RawResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/** Map one openapi-fetch result to the success envelope, or throw an ApiError. */
function process<T>(res: RawResult): SuccessEnvelope<T> {
  const requestId =
    res.response.headers.get(REQUEST_ID_HEADER) ??
    res.response.headers.get("X-Request-Id") ??
    "unknown";
  if (res.error !== undefined) {
    throw ApiError.fromEnvelope(res.error, res.response.status, requestId);
  }
  if (res.data === undefined) {
    throw ApiError.unknown(res.response.status, requestId);
  }
  return res.data as SuccessEnvelope<T>;
}

export function createApi(getToken: GetToken): Api {
  const raw = baseClient<paths>(getToken);
  const gapRaw = baseClient<ContractGapPaths>(getToken);

  const envelope = async <T>(fn: () => Promise<RawResult>): Promise<SuccessEnvelope<T>> => {
    let res: RawResult;
    try {
      res = await fn();
    } catch (cause) {
      throw ApiError.network(cause, generateRequestId());
    }
    return process<T>(res);
  };

  const run = async <T>(fn: () => Promise<RawResult>): Promise<T> =>
    (await envelope<T>(fn)).data;

  const list = async <T>(fn: () => Promise<RawResult>): Promise<ListResult<T>> => {
    const body = await envelope<T>(fn);
    return { data: body.data, meta: body.meta };
  };

  return {
    GET: (path, init) => run(() => raw.GET(path, init as never) as Promise<RawResult>),
    POST: (path, init) => run(() => raw.POST(path, init as never) as Promise<RawResult>),
    PATCH: (path, init) => run(() => raw.PATCH(path, init as never) as Promise<RawResult>),
    DELETE: (path, init) => run(() => raw.DELETE(path, init as never) as Promise<RawResult>),
    LIST: (path, init) => list(() => raw.GET(path, init as never) as Promise<RawResult>),
    gap: {
      GET: (path, init) => run(() => gapRaw.GET(path, init as never) as Promise<RawResult>),
      POST: (path, init) => run(() => gapRaw.POST(path, init as never) as Promise<RawResult>),
      DELETE: (path, init) => run(() => gapRaw.DELETE(path, init as never) as Promise<RawResult>),
    },
  };
}
