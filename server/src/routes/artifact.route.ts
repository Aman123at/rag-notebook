import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import {
  getArtifact,
  listArtifacts,
  requestArtifactRegeneration,
} from '@/services/artifact.service.js';

const list: DefinedRoute = defineRoute('artifacts.list', async (ctx) => {
  return listArtifacts(ctx.auth.userId, ctx.params.sourceId);
});

const create: DefinedRoute = defineRoute('artifacts.create', async (ctx) => {
  return requestArtifactRegeneration(ctx.auth.userId, ctx.params.sourceId, ctx.body);
});

const get: DefinedRoute = defineRoute('artifacts.get', async (ctx) => {
  return getArtifact(ctx.auth.userId, ctx.params.artifactId);
});

export const artifactsRealRoutes: readonly DefinedRoute[] = [list, create, get];
