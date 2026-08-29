import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { attachPaginationMeta, buildMeta, resolvePagination } from '@/http/pagination.js';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from '@/services/workspaces.service.js';

const list: DefinedRoute = defineRoute('workspaces.list', async (ctx) => {
  const window = resolvePagination(ctx.query);
  const { items, total } = await listWorkspaces(ctx.auth.userId, {
    limit: window.limit,
    offset: window.offset,
  });
  attachPaginationMeta(ctx.res, buildMeta(window, total));
  return items;
});

const create: DefinedRoute = defineRoute('workspaces.create', async (ctx) => {
  return createWorkspace(ctx.auth.userId, ctx.body);
});

const get: DefinedRoute = defineRoute('workspaces.get', async (ctx) => {
  return getWorkspace(ctx.auth.userId, ctx.params.workspaceId);
});

const update: DefinedRoute = defineRoute('workspaces.update', async (ctx) => {
  return updateWorkspace(ctx.auth.userId, ctx.params.workspaceId, ctx.body);
});

const remove: DefinedRoute = defineRoute('workspaces.delete', async (ctx) => {
  return deleteWorkspace(ctx.auth.userId, ctx.params.workspaceId);
});

export const workspacesRealRoutes: readonly DefinedRoute[] = [list, create, get, update, remove];
