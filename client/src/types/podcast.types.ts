/**
 * Podcast-domain wire types.
 *
 * These are hand-written rather than derived from `@/contract/types` because
 * the vendored contract predates the podcast routes and carries none of them
 * (see `@/lib/api/contract-gaps` for the matching typed paths and the tripwire
 * that fires once a contract drop finally publishes these schemas). Keep this
 * shape in lockstep with `PodcastSchema` in the server contract until then.
 */

/**
 * PENDING (queued) -> SCRIPTING (one LLM writes the two-host script) ->
 * SYNTHESIZING (TTS records each line, fragments concatenated) -> READY.
 * FAILED is terminal and occupies no slot.
 */
export type PodcastStatus =
  | "PENDING"
  | "SCRIPTING"
  | "SYNTHESIZING"
  | "READY"
  | "FAILED";

/** Why the audio no longer reflects the workspace's sources. Display-only. */
export type PodcastStaleReason = "SOURCES_CHANGED";

/**
 * The wire shape the client receives — audio only, no script, no citations.
 * `audioUrl` is a freshly-signed inline Cloudinary URL minted per response and
 * good only until `audioUrlExpiresAt`; both are null until the podcast is READY.
 * Refetch to obtain a fresh URL after expiry.
 */
export interface Podcast {
  id: string;
  workspaceId: string;
  status: PodcastStatus;
  audioUrl: string | null;
  audioUrlExpiresAt: string | null;
  durationSeconds: number | null;
  isStale: boolean;
  staleReason: PodcastStaleReason | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A podcast in a phase that is still producing audio — worth polling. */
export const PODCAST_IN_PROGRESS: readonly PodcastStatus[] = [
  "PENDING",
  "SCRIPTING",
  "SYNTHESIZING",
];

export function isPodcastInProgress(status: PodcastStatus): boolean {
  return PODCAST_IN_PROGRESS.includes(status);
}
