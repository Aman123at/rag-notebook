import type { Workspace } from "@/hooks/use-workspaces";
import type { Me } from "@/hooks/use-current-user";

let seq = 0;

export function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  seq += 1;
  return {
    id: overrides.id ?? `ws-${seq}`,
    name: overrides.name ?? `Workspace ${seq}`,
    description: overrides.description ?? null,
    sourceCount: overrides.sourceCount ?? 0,
    createdAt: overrides.createdAt ?? new Date(2026, 0, seq).toISOString(),
    updatedAt: overrides.updatedAt ?? new Date(2026, 0, seq).toISOString(),
  };
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: "user-1",
    email: "user@example.com",
    displayName: "Sample User",
    isActive: true,
    isBlocked: false,
    planTier: "FREE",
    limits: {
      lifetimeTokens: 1_000_000,
      maxFileBytes: 10_485_760,
      maxPlaylistVideos: 20,
      maxPromptWords: 5000,
      maxSourcesPerWorkspace: 7,
      maxWorkspaces: 10,
    },
    tokens: {
      assigned: 1_000_000,
      remaining: 900_000,
      usedCompletion: 50_000,
      usedEmbedding: 50_000,
    },
    usage: { workspaces: 3 },
    ...overrides,
  };
}
