/**
 * Local schema for the `content` field on a PLAYLIST_ROADMAP artifact.
 *
 * The v0.6.0 contract types `Artifact.content` as `unknown | null` — the shape
 * is unspecified — so this module reifies the shape the server's generator
 * actually writes and validates it defensively with zod:
 *
 *   { overview, totalMinutes, difficulty, modules: [
 *       { title, objective, videoIds, estimatedMinutes, prerequisites, keyConcepts }
 *   ] }
 *
 * `videoIds` are child `sources.id`s, not YouTube ids, and the content carries
 * no titles — so the renderer joins them against the playlist's child sources
 * to get a name and a link, and reports any child the roadmap doesn't cover.
 */
import { z } from "zod";

const artifactModuleSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  videoIds: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.number().int().min(0),
  prerequisites: z.array(z.string()).default([]),
  keyConcepts: z.array(z.string()).default([]),
});

/** The artifact exactly as the server stores it. */
export const roadmapArtifactSchema = z.object({
  overview: z.string().min(1),
  totalMinutes: z.number().int().min(0),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  modules: z.array(artifactModuleSchema).min(1),
});

/**
 * One child video of the playlist, as the roadmap page knows it — supplied by
 * the caller from the sources list, not by the artifact.
 */
export interface PlaylistVideo {
  /** The child source id, which is what `videoIds` holds. */
  id: string;
  title: string;
  /** The original YouTube URL. */
  url: string;
  /** True once the video is indexed; unready videos can't be in a module. */
  indexed: boolean;
  /** Why an unready video didn't make it, when the server said. */
  failureMessage?: string | undefined;
}

export interface RoadmapVideoRef {
  videoId: string;
  title: string;
  url?: string | undefined;
}

export interface RoadmapModule {
  id: string;
  order: number;
  title: string;
  objective: string;
  estimatedMinutes: number;
  prerequisites: readonly string[];
  keyConcepts: readonly string[];
  videos: readonly RoadmapVideoRef[];
}

export interface RoadmapMissingVideo {
  videoId?: string | undefined;
  title?: string | undefined;
  reason?: string | undefined;
}

export interface RoadmapContent {
  overview: string;
  totalMinutes: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  modules: readonly RoadmapModule[];
  missingVideos: readonly RoadmapMissingVideo[];
}

export type RoadmapParse =
  | { ok: true; content: RoadmapContent }
  | { ok: false; error: string };

/**
 * Validate the stored artifact and join it against the playlist's children.
 *
 * `videos` may be empty — while the sources list is still loading, or if the
 * join comes up short — in which case a module still renders with its id as
 * the video's name rather than dropping the row. A roadmap that names a
 * station is more use than one that hides it.
 */
export function parseRoadmapContent(
  raw: unknown,
  videos: readonly PlaylistVideo[] = [],
): RoadmapParse {
  const result = roadmapArtifactSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".") || "content";
    const msg = first?.message ?? "invalid shape";
    return { ok: false, error: `${path}: ${msg}` };
  }

  const byId = new Map(videos.map((v) => [v.id, v]));
  const covered = new Set<string>();

  const modules: RoadmapModule[] = result.data.modules.map((m, i) => ({
    // The server doesn't number its modules; the array order is the route
    // order. The id is what module progress is stored under, so it has to be
    // stable across refetches of the same artifact — the position is.
    id: `m${i + 1}`,
    order: i + 1,
    title: m.title,
    objective: m.objective,
    estimatedMinutes: m.estimatedMinutes,
    prerequisites: m.prerequisites,
    keyConcepts: m.keyConcepts,
    videos: m.videoIds.map((id) => {
      covered.add(id);
      const video = byId.get(id);
      return {
        videoId: id,
        title: video?.title ?? id,
        url: video?.url,
      };
    }),
  }));

  // "Missing" means a video of this playlist that no module references — in
  // practice one that never finished indexing, since the generator only sees
  // indexed children.
  const missingVideos: RoadmapMissingVideo[] = videos
    .filter((v) => !covered.has(v.id))
    .map((v) => ({
      videoId: v.id,
      title: v.title,
      reason: v.failureMessage,
    }));

  return {
    ok: true,
    content: {
      overview: result.data.overview,
      totalMinutes: result.data.totalMinutes,
      difficulty: result.data.difficulty,
      modules,
      missingVideos,
    },
  };
}

/**
 * Format a start offset as `mm:ss` / `h:mm:ss` for the module-video row.
 */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/**
 * The link for a module's video row. The artifact carries only the child
 * source id, so the URL comes from the joined source; without it there is
 * nothing safe to link to and the row renders as plain text.
 */
export function youtubeLinkFor(video: RoadmapVideoRef): string | undefined {
  return video.url;
}
