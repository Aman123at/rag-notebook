import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import {
  createWorkspacePodcast,
  deleteWorkspacePodcast,
  getWorkspacePodcast,
} from '@/services/podcast.service.js';

const get: DefinedRoute = defineRoute('podcasts.get', async (ctx) => {
  return getWorkspacePodcast(ctx.auth.userId, ctx.params.workspaceId);
});

const create: DefinedRoute = defineRoute('podcasts.create', async (ctx) => {
  return createWorkspacePodcast(ctx.auth.userId, ctx.params.workspaceId);
});

const remove: DefinedRoute = defineRoute('podcasts.delete', async (ctx) => {
  return deleteWorkspacePodcast(ctx.auth.userId, ctx.params.workspaceId);
});

export const podcastsRealRoutes: readonly DefinedRoute[] = [get, create, remove];
