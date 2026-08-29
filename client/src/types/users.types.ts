/**
 * User-domain type aliases surfaced by the identity + usage hooks.
 */
import type { GetResult } from "@/lib/api/types";

export type Me = GetResult<"/me">;
export type Usage = GetResult<"/me/usage">;
