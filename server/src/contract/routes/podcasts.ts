import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';

/**
 * A podcast is a single ~10-minute two-host audio overview generated from every
 * ready source in a workspace. There is exactly one per workspace (enforced by a
 * unique constraint on `workspace_id`); regenerating supersedes the previous one.
 * See CONTEXT.md for the domain vocabulary (Podcast, Host, Script, Slot, Stale).
 */

/**
 * Lifecycle: PENDING (queued) -> SCRIPTING (one LLM writes the two-host script)
 * -> SYNTHESIZING (TTS records each line, fragments are concatenated) -> READY.
 * FAILED is terminal and, per the slot rules, occupies no slot. There is no
 * SKIPPED: a podcast is always explicitly requested, never auto-generated.
 */
export const PODCAST_STATUSES = [
  'PENDING',
  'SCRIPTING',
  'SYNTHESIZING',
  'READY',
  'FAILED',
] as const;
export const PodcastStatusSchema = z.enum(PODCAST_STATUSES);
export type PodcastStatus = z.infer<typeof PodcastStatusSchema>;

/**
 * Why a podcast is stale. A stale flag is display-only: it never triggers work.
 * Any change to the workspace's source set (adding or deleting a source) marks
 * the podcast stale so the user knows the audio no longer reflects the sources.
 */
export const PODCAST_STALE_REASONS = ['SOURCES_CHANGED'] as const;
export const PodcastStaleReasonSchema = z.enum(PODCAST_STALE_REASONS);
export type PodcastStaleReason = z.infer<typeof PodcastStaleReasonSchema>;

/**
 * ── Script generation constants (server-internal) ──────────────────────────
 *
 * The two hosts are ROLES, not personalities, so the schema stays stable if the
 * names change: `HOST_A` drives and asks, `HOST_B` explains and synthesises. The
 * display names and voices are mapped from these role keys and live only here.
 * None of this is on the wire — the client never sees the script (audio only).
 */
export const PODCAST_SPEAKERS = ['HOST_A', 'HOST_B'] as const;
export const PodcastSpeakerSchema = z.enum(PODCAST_SPEAKERS);
export type PodcastSpeaker = z.infer<typeof PodcastSpeakerSchema>;

/** Display names the prompt maps the role keys to; renaming never touches the schema. */
export const PODCAST_HOSTS: Record<PodcastSpeaker, string> = {
  HOST_A: 'Maya',
  HOST_B: 'Ravi',
};

/**
 * Fixed voice + steering per role (no per-podcast storage; there is no picker).
 * `voice` values are OpenAI `gpt-4o-mini-tts` voices confirmed by research;
 * `fallbackVoice` is the documented pair used when the primary 404s. Both hosts
 * share a warm, unhurried base with a one-line role tint in `instructions`.
 */
export const PODCAST_VOICES: Record<
  PodcastSpeaker,
  { voice: string; fallbackVoice: string; instructions: string }
> = {
  HOST_A: {
    voice: 'marin',
    fallbackVoice: 'shimmer',
    instructions:
      'Conversational, warm, and unhurried, like a host on an educational podcast — not a news reader. Slightly bright and inquisitive; you are the one driving the conversation and asking the questions.',
  },
  HOST_B: {
    voice: 'cedar',
    fallbackVoice: 'onyx',
    instructions:
      'Conversational, warm, and unhurried, like a host on an educational podcast — not a news reader. Steady and a touch lower in energy; you are the one who explains and synthesises the material.',
  },
};

/**
 * ~150 wpm against a hard 10-minute ceiling ≈ 1,500 words; we hold headroom under
 * it. MAX is the primary length gate — a too-long script is rejected before any
 * TTS money is spent. MIN guards against a degenerate two-turn "podcast".
 */
export const PODCAST_MAX_WORDS = 1_400;
/**
 * The length the script prompt actively targets (~5–6 min at ~145 wpm). Set from
 * a live end-to-end test: gpt-4o-mini plateaus around 750 words on sparse input
 * even under aggressive length prompting, so 1,200 was unreachable and produced
 * pointless retries. 800 is a target it can actually hit; real multi-source
 * workspaces run longer on their own. MAX remains the hard reject gate above it.
 * If episodes ever feel short on real data, add a stronger PODCAST_SCRIPT_MODEL
 * rather than raising this number past what the model will deliver.
 */
export const PODCAST_TARGET_WORDS = 800;
/**
 * Floor guarding against a degenerate two-turn "podcast". Kept deliberately low:
 * a genuinely small workspace (one or two short sources) SHOULD yield a short
 * overview rather than being padded to fill time. It is not a target.
 */
export const PODCAST_MIN_WORDS = 400;

/** Per-turn char ceiling that keeps every turn a single TTS request (< 4096). */
export const PODCAST_MAX_TURN_CHARS = 600;

const countWords = (s: string): number => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);

/**
 * The schema the script LLM is forced to satisfy (same spirit as
 * `PlaylistRoadmapContentSchema`). Server-internal: validated in the generation
 * job, persisted to the JSONB `script` column, never serialized to the client.
 * The total-word-count bounds are a refinement so turns can vary length freely.
 */
export const PodcastScriptTurnSchema = z.object({
  speaker: PodcastSpeakerSchema,
  text: z.string().min(1).max(PODCAST_MAX_TURN_CHARS),
});
export type PodcastScriptTurn = z.infer<typeof PodcastScriptTurnSchema>;

export const PodcastScriptSchema = z
  .object({
    title: z.string().min(1).max(120),
    turns: z.array(PodcastScriptTurnSchema).min(1).max(80),
  })
  .superRefine((script, ctx) => {
    const words = script.turns.reduce((acc, t) => acc + countWords(t.text), 0);
    if (words > PODCAST_MAX_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turns'],
        message: `Script is ${words} words; the ceiling is ${PODCAST_MAX_WORDS}.`,
      });
    }
    if (words < PODCAST_MIN_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turns'],
        message: `Script is only ${words} words; the floor is ${PODCAST_MIN_WORDS}.`,
      });
    }
  });
export type PodcastScript = z.infer<typeof PodcastScriptSchema>;

/**
 * The wire shape the client receives. It deliberately carries NO script and NO
 * citations — the podcast is audio only. The script lives server-side in a JSONB
 * column for diagnostics and is never serialized here.
 *
 * `audioUrl` is a freshly-signed, inline (non-attachment) Cloudinary URL minted
 * per response; `audioUrlExpiresAt` is when it stops working. Both are null until
 * the podcast is READY. Clients refetch to obtain a fresh URL after expiry.
 */
export const PodcastSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: PodcastStatusSchema,
  audioUrl: z.string().url().nullable(),
  audioUrlExpiresAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  isStale: z.boolean(),
  staleReason: PodcastStaleReasonSchema.nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Podcast = z.infer<typeof PodcastSchema>;

export const WorkspacePodcastParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const podcastsRoutes = {
  'podcasts.get': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces/:workspaceId/podcast',
    auth: 'required',
    params: WorkspacePodcastParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: PodcastSchema.nullable(),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['podcasts'],
    summary:
      "Get the workspace's podcast, or null if none has been generated. Mints a fresh signed audio URL when READY.",
  }),
  'podcasts.create': defineRouteDefinition({
    method: 'POST',
    path: '/workspaces/:workspaceId/podcast',
    auth: 'required',
    params: WorkspacePodcastParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: PodcastSchema,
    // 202: generation is asynchronous. The client polls podcasts.get for READY.
    successStatus: 202,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      // PLAN_LIMIT_EXCEEDED: the caller's concurrent podcast slots are full.
      'PLAN_LIMIT_EXCEEDED',
      // TOKEN_QUOTA_EXCEEDED: not enough tokens remain to reserve the script call.
      'TOKEN_QUOTA_EXCEEDED',
      // CONFLICT: a podcast already exists for this workspace (delete it first).
      'CONFLICT',
      // SOURCE_NOT_READY: the workspace has no ready sources to summarize.
      'SOURCE_NOT_READY',
      'INTERNAL_ERROR',
    ],
    tags: ['podcasts'],
    summary:
      "Generate the workspace's podcast. Enforces the per-plan concurrent slot cap and requires at least one ready source. Returns 202 with the PENDING podcast.",
  }),
  'podcasts.delete': defineRouteDefinition({
    method: 'DELETE',
    path: '/workspaces/:workspaceId/podcast',
    auth: 'required',
    params: WorkspacePodcastParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['podcasts'],
    summary:
      'Hard-delete the workspace podcast and destroy its Cloudinary asset. Frees a slot immediately.',
  }),
} as const;
