import { type DefinedRoute, defineRoute, defineSseRoute } from '@/http/defineRoute.js';
import {
  encodeSourceStreamSSE,
  publishSourceEvent,
  subscribeToSourceEvents,
} from '@/services/source/events.js';
import {
  createDownloadUrl,
  createSource,
  createUploadIntent,
  deleteSource,
  getSource,
  getSourcePreview,
  getSourceStatus,
  listSources,
  retrySource,
} from '@/services/source/service.js';

const uploadIntent: DefinedRoute = defineRoute('sources.uploadIntent', async (ctx) => {
  const env = await createUploadIntent(ctx.auth.userId, ctx.params.workspaceId, ctx.body);
  return env;
});

const create: DefinedRoute = defineRoute('sources.create', async (ctx) => {
  return createSource(ctx.auth.userId, ctx.params.workspaceId, ctx.body);
});

const list: DefinedRoute = defineRoute('sources.list', async (ctx) => {
  return listSources(ctx.auth.userId, ctx.params.workspaceId);
});

const get: DefinedRoute = defineRoute('sources.get', async (ctx) => {
  return getSource(ctx.auth.userId, ctx.params.sourceId);
});

const status: DefinedRoute = defineRoute('sources.status', async (ctx) => {
  return getSourceStatus(ctx.auth.userId, ctx.params.sourceId);
});

const retry: DefinedRoute = defineRoute('sources.retry', async (ctx) => {
  return retrySource(ctx.auth.userId, ctx.params.sourceId);
});

const remove: DefinedRoute = defineRoute('sources.delete', async (ctx) => {
  return deleteSource(ctx.auth.userId, ctx.params.sourceId);
});

const download: DefinedRoute = defineRoute('sources.download', async (ctx) => {
  return createDownloadUrl(ctx.auth.userId, ctx.params.sourceId);
});

const preview: DefinedRoute = defineRoute('sources.preview', async (ctx) => {
  return getSourcePreview(ctx.auth.userId, ctx.params.sourceId, ctx.query.chunkId);
});

const HEARTBEAT_MS = 20_000;

const statusStream: DefinedRoute = defineSseRoute('sources.statusStream', async (ctx) => {
  const { userId } = ctx.auth;
  const { workspaceId } = ctx.params;
  await listSources(userId, workspaceId);

  ctx.res.setHeader('Content-Type', 'text/event-stream');
  ctx.res.setHeader('Cache-Control', 'no-cache, no-transform');
  ctx.res.setHeader('Connection', 'keep-alive');
  ctx.res.setHeader('X-Accel-Buffering', 'no');
  ctx.res.flushHeaders?.();

  ctx.res.write(encodeSourceStreamSSE({ type: 'heartbeat', data: { t: Date.now() } }));

  const unsubscribe = subscribeToSourceEvents(userId, workspaceId, (event) => {
    if (ctx.res.writableEnded) return;
    ctx.res.write(encodeSourceStreamSSE(event));
  });

  const heartbeat = setInterval(() => {
    if (ctx.res.writableEnded) return;
    ctx.res.write(encodeSourceStreamSSE({ type: 'heartbeat', data: { t: Date.now() } }));
  }, HEARTBEAT_MS);

  heartbeat.unref?.();

  let cleanedUp = false;
  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(heartbeat);
    unsubscribe();
    if (!ctx.res.writableEnded) ctx.res.end();
  };
  ctx.req.on('close', cleanup);
  ctx.req.on('error', cleanup);
  ctx.res.on('close', cleanup);
  ctx.res.on('error', cleanup);

  await new Promise<void>((resolve) => {
    const done = (): void => {
      cleanup();
      resolve();
    };
    ctx.req.on('close', done);
    ctx.req.on('error', done);
  });
});

export { publishSourceEvent };

export const sourcesRealRoutes: readonly DefinedRoute[] = [
  uploadIntent,
  create,
  list,
  get,
  status,
  retry,
  remove,
  download,
  preview,
  statusStream,
];
