import type { components, paths } from "@/contract/types";
import type { PathsWithMethod } from "openapi-typescript-helpers";

export type Paths = paths;
export type ApiErrorPayload = components["schemas"]["ApiError"]["error"];
export type ErrorCode = ApiErrorPayload["code"];
export type PaginationMeta = components["schemas"]["PaginationMeta"];

/** Envelope shape shared by every success response, per contract §4.1. */
export interface SuccessEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * A route's declared 200 `application/json` body — the envelope, not yet peeled.
 *
 * Strictly 200 and strictly JSON, which is deliberate. A route whose 200 is
 * `text/event-stream` (today: `POST /chats/{chatId}/messages`) resolves to
 * `never`, because the typed client genuinely cannot fetch it — SSE goes
 * through `openChatStream` instead. Widening this to "any 2xx, any media type"
 * would hand that route a plausible-looking type built from one SSE *event*,
 * which is what the duplicate definition in the `Api` interface used to do.
 */
type JsonBody<Op> = Op extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;

type Unwrap<T> = T extends SuccessEnvelope<infer D> ? D : never;

/**
 * The result of calling method `M` on route `P` of any paths object — the
 * vendored `paths`, or the hand-written `ContractGapPaths` for the routes the
 * contract describes wrongly. One definition; the four aliases below name it.
 */
export type ResultOf<
  TPaths,
  P extends keyof TPaths,
  M extends "get" | "post" | "patch" | "delete",
> = Unwrap<JsonBody<TPaths[P] extends Record<M, infer O> ? O : never>>;

/**
 * Response data type for a route, unwrapped from the envelope.
 *
 * These four are the single definition of a contract route's result.
 * `@/interfaces/api.interface` imports them; nothing recomputes them.
 */
export type GetResult<P extends PathsWithMethod<paths, "get">> = ResultOf<paths, P, "get">;
export type PostResult<P extends PathsWithMethod<paths, "post">> = ResultOf<paths, P, "post">;
export type PatchResult<P extends PathsWithMethod<paths, "patch">> = ResultOf<paths, P, "patch">;
export type DeleteResult<P extends PathsWithMethod<paths, "delete">> = ResultOf<
  paths,
  P,
  "delete"
>;

/**
 * A paginated GET, envelope intact. `GET` unwraps to `data` and drops `meta`,
 * which is right for the overwhelming majority of reads; a caller that needs
 * `meta.total` — the truthful count of a list it deliberately did not page
 * through — asks for this instead of reaching into the raw client.
 */
export interface ListResult<T> {
  data: T;
  meta: PaginationMeta | undefined;
}
