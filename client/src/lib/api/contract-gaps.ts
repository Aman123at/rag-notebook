/**
 * Routes the vendored contract describes incorrectly, described the way the
 * server actually behaves.
 *
 * This is the *only* door out of the generated types, and it is deliberately a
 * closed one: it is a paths object listing two named routes, not an untyped
 * request function. A call through it is as type-checked as any other — what
 * differs is that the shape it checks against was written here, by us, rather
 * than generated from `src/contract/`.
 *
 * Rules for this file:
 *   - Every member cites its entry in `docs/CONTRACT-FEEDBACK.md`. No entry, no
 *     member — a route that is merely inconvenient does not belong here.
 *   - Nothing in `src/contract/` is edited or overridden (CLAUDE.md Law 2). The
 *     vendored types still describe these routes wrongly; this file does not
 *     silence that, it routes around it in one visible place.
 *   - When a contract drop fixes a route, delete its member here and move the
 *     caller onto the generated types. The tripwire at the bottom of this file
 *     makes that moment loud: it stops compiling as soon as the vendored types
 *     grow a request body for either route.
 */
import type { paths } from "@/contract/types";
import type { SuccessEnvelope } from "./types";
import type { CreateSourceBody, Source } from "@/types/sources.types";

export interface ContractGapPaths {
  /**
   * CONTRACT-FEEDBACK #2. The generated type says `requestBody?: never`; the
   * server requires the create body (`{ type, publicId, fileName, sizeBytes }`
   * for uploads, `{ type, url }` for URL sources).
   */
  "/workspaces/{workspaceId}/sources": {
    post: {
      parameters: { path: { workspaceId: string } };
      requestBody: { content: { "application/json": CreateSourceBody } };
      responses: { 200: { content: { "application/json": SuccessEnvelope<Source> } } };
    };
  };
  /**
   * CONTRACT-FEEDBACK #2. Same defect, same route family. The body is genuinely
   * optional here — the server re-runs the pipeline with the stored inputs — so
   * this one is only in the list because `never` also forbids *omitting* the
   * body on a route openapi-fetch believes takes none.
   */
  "/sources/{sourceId}/retry": {
    post: {
      parameters: { path: { sourceId: string } };
      requestBody?: { content: { "application/json": Record<string, never> } };
      responses: { 200: { content: { "application/json": SuccessEnvelope<Source> } } };
    };
  };
}

/** The request-body type the vendored contract declares for a POST route. */
type VendoredPostBody<P extends keyof paths> = paths[P] extends {
  post: { requestBody?: infer B };
}
  ? B
  : never;

/**
 * The tripwire. Deleting a member of `ContractGapPaths` cannot be prompted by
 * the compiler — a fixed contract would just leave this file quietly routing
 * around a defect that no longer exists — so assert the defect instead.
 *
 * Each line reads "the vendored type for this route still declares no request
 * body". When a contract drop finally publishes the schemas, the matching line
 * stops compiling: that is the signal to delete the route from
 * `ContractGapPaths`, move its caller in `src/hooks/use-sources.ts` onto
 * `api.POST`, and strike the entry from `docs/CONTRACT-FEEDBACK.md`.
 */
type StillMissingItsBody<T extends true> = T;

type _CreateSourceStillBroken = StillMissingItsBody<
  [VendoredPostBody<"/workspaces/{workspaceId}/sources">] extends [never] ? true : false
>;
type _RetrySourceStillBroken = StillMissingItsBody<
  [VendoredPostBody<"/sources/{sourceId}/retry">] extends [never] ? true : false
>;

export type { _CreateSourceStillBroken, _RetrySourceStillBroken };
