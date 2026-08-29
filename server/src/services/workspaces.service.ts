import { type Workspace } from '@/contract/index.js';
import { type Executor, withTransaction } from '@/db/client.js';
import { type WorkspaceRow } from '@/db/schema/index.js';
import { AppError } from '@/errors/AppError.js';
import { sendEvent } from '@/inngest/events.js';
import { softDeleteSourcesForWorkspace } from '@/repository/sources.repo.js';
import {
  adjustSourceCount as _adjustSourceCount,
  findWorkspaceForUser,
  insertWorkspace,
  listWorkspacesForUserPaged,
  softDeleteChatsForWorkspace as repoSoftDeleteChats,
  softDeleteWorkspaceForUser,
  updateWorkspaceForUser,
} from '@/repository/workspaces.repo.js';
import { assertCanCreateWorkspace } from '@/services/entitlements/index.js';
import type { ListWorkspacesResult } from '@/types/workspaces.types.js';

void _adjustSourceCount;

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  const walk = (e: unknown, depth = 0): boolean => {
    if (e === null || typeof e !== 'object' || depth > 3) return false;
    const code = (e as { code?: unknown }).code;
    if (code === PG_UNIQUE_VIOLATION) return true;
    return walk((e as { cause?: unknown }).cause, depth + 1);
  };
  return walk(err);
}

function toWire(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceCount: row.sourceCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWorkspaces(
  userId: string,
  window: { limit: number; offset: number },
): Promise<ListWorkspacesResult> {
  const { rows, total } = await listWorkspacesForUserPaged(userId, window);
  return { items: rows.map(toWire), total };
}

export async function createWorkspace(
  userId: string,
  input: { name: string; description?: string | undefined },
): Promise<Workspace> {
  await assertCanCreateWorkspace(userId);
  try {
    const row = await insertWorkspace({
      userId,
      name: input.name,
      description: input.description ?? null,
    });
    return toWire(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('CONFLICT', 'A workspace with that name already exists.', {
        details: { field: 'name' },
      });
    }
    throw err;
  }
}

export async function getWorkspace(userId: string, workspaceId: string): Promise<Workspace> {
  const row = await findWorkspaceForUser(userId, workspaceId);
  if (!row) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }
  return toWire(row);
}

export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  patch: { name?: string | undefined; description?: string | null | undefined },
): Promise<Workspace> {
  const existing = await findWorkspaceForUser(userId, workspaceId);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
  }

  if (patch.name === undefined && patch.description === undefined) return toWire(existing);

  const dbPatch: { name?: string; description?: string | null } = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  try {
    const updated = await updateWorkspaceForUser(userId, workspaceId, dbPatch);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
    }
    return toWire(updated);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('CONFLICT', 'A workspace with that name already exists.', {
        details: { field: 'name' },
      });
    }
    throw err;
  }
}

export async function deleteWorkspace(
  userId: string,
  workspaceId: string,
): Promise<{ id: string; deleted: true }> {
  const result = await withTransaction(async (tx: Executor) => {
    const existing = await findWorkspaceForUser(userId, workspaceId, tx);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
    }
    await repoSoftDeleteChats(userId, workspaceId, tx);
    await softDeleteSourcesForWorkspace(userId, workspaceId, tx);
    const deleted = await softDeleteWorkspaceForUser(userId, workspaceId, tx);
    if (!deleted) {
      throw new AppError('NOT_FOUND', 'Workspace not found.', { exposeDetails: false });
    }
    return { id: deleted.id, deleted: true as const };
  });
  await sendEvent(
    'workspace/cleanup.requested',
    { workspaceId, userId },
    { idempotencyKey: workspaceId },
  );
  return result;
}
