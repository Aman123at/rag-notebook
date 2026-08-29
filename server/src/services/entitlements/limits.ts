import { env } from '@/config/env.js';
import {
  type CustomPlanLimits,
  PLAN_LIMITS,
  type PlanLimits,
  type PlanTier,
} from '@/contract/index.js';
import { AppError } from '@/errors/AppError.js';
import { findUserById } from '@/repository/users.repo.js';
import { findWorkspaceForUser } from '@/repository/workspaces.repo.js';
import type { PlanLimitExceededDetails } from '@/types/entitlements.types.js';

export function upgradeUrl(): string {
  return new URL('/billing/upgrade', env.APP_URL).toString();
}

export function limitsForTier(tier: PlanTier): PlanLimits | CustomPlanLimits {
  return PLAN_LIMITS[tier];
}

function isCustom(l: PlanLimits | CustomPlanLimits): l is CustomPlanLimits {
  return (l as CustomPlanLimits).contactOnly === true;
}

function raise(message: string, limit: number, current: number, plan: PlanTier): never {
  const details: PlanLimitExceededDetails = { limit, current, plan, upgradeUrl: upgradeUrl() };
  throw new AppError('PLAN_LIMIT_EXCEEDED', message, { details, exposeDetails: true });
}

async function loadUserOrThrow(userId: string): Promise<{ id: string; planTier: PlanTier }> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found.', { exposeDetails: false });
  }
  return { id: user.id, planTier: user.planTier };
}

async function countLiveWorkspaces(userId: string): Promise<number> {
  const { countWorkspacesForUser } = await import('@/repository/users.repo.js');
  return countWorkspacesForUser(userId);
}

export async function assertCanCreateWorkspace(userId: string): Promise<void> {
  const user = await loadUserOrThrow(userId);
  const limits = limitsForTier(user.planTier);
  if (isCustom(limits) || limits.maxWorkspaces === null) return;
  const current = await countLiveWorkspaces(userId);
  if (current >= limits.maxWorkspaces) {
    raise(
      `Workspace limit reached (${limits.maxWorkspaces}).`,
      limits.maxWorkspaces,
      current,
      user.planTier,
    );
  }
}

export async function assertCanAddSource(
  userId: string,
  workspaceId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  const user = await loadUserOrThrow(userId);
  const limits = limitsForTier(user.planTier);
  if (isCustom(limits) || limits.maxSourcesPerWorkspace === null) return;

  const workspace = await findWorkspaceForUser(userId, workspaceId);
  if (!workspace) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }
  const current = workspace.sourceCount;
  if (current + count > limits.maxSourcesPerWorkspace) {
    raise(
      `Source limit reached for this workspace (${limits.maxSourcesPerWorkspace}).`,
      limits.maxSourcesPerWorkspace,
      current,
      user.planTier,
    );
  }
}

export async function assertPromptLength(userId: string, content: string): Promise<void> {
  const user = await loadUserOrThrow(userId);
  const limits = limitsForTier(user.planTier);
  if (isCustom(limits) || limits.maxPromptWords === null) return;
  const current = countWords(content);
  if (current > limits.maxPromptWords) {
    raise(
      `Prompt too long — ${limits.maxPromptWords} words maximum.`,
      limits.maxPromptWords,
      current,
      user.planTier,
    );
  }
}

export async function assertFileSize(userId: string, bytes: number): Promise<void> {
  const user = await loadUserOrThrow(userId);
  const limits = limitsForTier(user.planTier);
  if (isCustom(limits)) return;
  if (bytes > limits.maxFileBytes) {
    raise(
      `File too large — ${limits.maxFileBytes} bytes maximum.`,
      limits.maxFileBytes,
      bytes,
      user.planTier,
    );
  }
}

export async function assertPlaylistSize(userId: string, videoCount: number): Promise<void> {
  const user = await loadUserOrThrow(userId);
  const limits = limitsForTier(user.planTier);
  if (isCustom(limits)) return;
  if (videoCount > limits.maxPlaylistVideos) {
    raise(
      `Playlist too large — ${limits.maxPlaylistVideos} videos maximum.`,
      limits.maxPlaylistVideos,
      videoCount,
      user.planTier,
    );
  }
}

export function countWords(text: string): number {
  if (text.length === 0) return 0;
  const cjkGlyphs =
    text.match(/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/gu)?.length ?? 0;

  const stripped = text.replace(/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/gu, ' ');
  const words = stripped.match(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu) ?? [];
  return cjkGlyphs + words.length;
}
