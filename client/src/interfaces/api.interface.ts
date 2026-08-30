/**
 * The typed API client shape. Method params/results are inferred from the
 * vendored OpenAPI paths.
 *
 * The four result types live in `@/lib/api/types` and are imported here rather
 * than recomputed. They used to be defined twice — once there off the route's
 * declared 200 `application/json` body, once here off `openapi-fetch`'s
 * `MethodResponse` — and the two disagreed. See that module for what the
 * surviving definition means.
 */
import type { FetchOptions } from "openapi-fetch";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import type { paths } from "@/contract/types";
import type { ContractGapPaths } from "@/lib/api/contract-gaps";
import type {
  DeleteResult,
  GetResult,
  ListResult,
  PatchResult,
  PostResult,
  ResultOf,
} from "@/lib/api/types";

type OpFor<P, M extends "get" | "post" | "patch" | "delete"> = P extends Record<M, infer O> ? O : never;

export interface Api {
  GET<P extends PathsWithMethod<paths, "get">>(
    path: P,
    init?: FetchOptions<OpFor<paths[P], "get">>,
  ): Promise<GetResult<P>>;
  POST<P extends PathsWithMethod<paths, "post">>(
    path: P,
    init?: FetchOptions<OpFor<paths[P], "post">>,
  ): Promise<PostResult<P>>;
  PATCH<P extends PathsWithMethod<paths, "patch">>(
    path: P,
    init?: FetchOptions<OpFor<paths[P], "patch">>,
  ): Promise<PatchResult<P>>;
  DELETE<P extends PathsWithMethod<paths, "delete">>(
    path: P,
    init?: FetchOptions<OpFor<paths[P], "delete">>,
  ): Promise<DeleteResult<P>>;

  /**
   * A GET that keeps the pagination envelope: `{ data, meta }` rather than
   * `data`. Use it only when `meta` is the point — a count the caller refuses
   * to page through for. Everything else uses `GET`.
   */
  LIST<P extends PathsWithMethod<paths, "get">>(
    path: P,
    init?: FetchOptions<OpFor<paths[P], "get">>,
  ): Promise<ListResult<GetResult<P>>>;

  /**
   * Routes the vendored contract types describe incorrectly or omit entirely
   * (the podcast family), called against the shapes the server actually
   * accepts. Requests go through the
   * same middleware, envelope unwrapping and error mapping as everything else —
   * only the type they are checked against differs.
   */
  gap: {
    GET<P extends PathsWithMethod<ContractGapPaths, "get">>(
      path: P,
      init?: FetchOptions<OpFor<ContractGapPaths[P], "get">>,
    ): Promise<ResultOf<ContractGapPaths, P, "get">>;
    POST<P extends PathsWithMethod<ContractGapPaths, "post">>(
      path: P,
      init?: FetchOptions<OpFor<ContractGapPaths[P], "post">>,
    ): Promise<ResultOf<ContractGapPaths, P, "post">>;
    DELETE<P extends PathsWithMethod<ContractGapPaths, "delete">>(
      path: P,
      init?: FetchOptions<OpFor<ContractGapPaths[P], "delete">>,
    ): Promise<ResultOf<ContractGapPaths, P, "delete">>;
  };
}
