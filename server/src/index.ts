import { type Server } from 'node:http';

import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from '@/config/env.js';
import { contractVersionMiddleware } from '@/http/middleware/contractVersion.js';
import { errorHandlerMiddleware, notFoundHandler } from '@/http/middleware/errorHandler.js';
import { closeRateLimiter } from '@/http/middleware/rateLimit.js';
import { httpLoggerMiddleware, requestIdMiddleware } from '@/http/middleware/requestId.js';
import { requestTimeoutMiddleware } from '@/http/middleware/timeout.js';
import { buildAppRouter } from '@/http/router.js';
import { buildInngestServeHandler, INNGEST_SERVE_PATH } from '@/inngest/serve.js';
import { ensureQdrantCollection } from '@/integrations/qdrant.js';
import { logger } from '@/observability/logger.js';
import { initTracing, shutdownTracing } from '@/observability/tracing.js';
import { artifactsRealRoutes } from '@/routes/artifact.route.js';
import { billingRealRoutes } from '@/routes/billing.route.js';
import { chatsRealRoutes } from '@/routes/chats.route.js';
import { identityRealRoutes } from '@/routes/identity.route.js';
import { memoryRealRoutes } from '@/routes/memory.route.js';
import { messagesRealRoutes } from '@/routes/message.route.js';
import { observabilityRealRoutes } from '@/routes/observability.route.js';
import { opsRealRoutes } from '@/routes/ops.route.js';
import { sourcesRealRoutes } from '@/routes/source.route.js';
import { webhooksRealRoutes } from '@/routes/webhooks.route.js';
import { workspacesRealRoutes } from '@/routes/workspaces.route.js';

const SHUTDOWN_DRAIN_MS = 15_000;

export interface BuildAppOptions {
  preRouterMiddleware?: express.RequestHandler;
}

export function buildApp(options: BuildAppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(requestIdMiddleware());
  app.use(httpLoggerMiddleware());
  app.use(contractVersionMiddleware());
  app.use(requestTimeoutMiddleware());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: env.CLIENT_ORIGINS,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Contract-Version'],
      exposedHeaders: ['X-Request-Id', 'X-Contract-Version'],
    }),
  );

  const jsonWithRaw = express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  });
  app.use(jsonWithRaw);
  app.use(cookieParser());

  if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
    app.use(clerkMiddleware());
  }

  const inngestHandler = buildInngestServeHandler() as express.RequestHandler;
  app.use(INNGEST_SERVE_PATH, inngestHandler);

  if (options.preRouterMiddleware) {
    app.use(options.preRouterMiddleware);
  }

  const apiRouter = buildAppRouter([
    ...opsRealRoutes,
    ...observabilityRealRoutes,
    ...identityRealRoutes,
    ...webhooksRealRoutes,
    ...workspacesRealRoutes,
    ...chatsRealRoutes,
    ...messagesRealRoutes,
    ...sourcesRealRoutes,
    ...memoryRealRoutes,
    ...billingRealRoutes,
    ...artifactsRealRoutes,
  ]);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler());
  app.use(errorHandlerMiddleware());

  return app;
}

function bootstrap(): void {
  initTracing();

  const app = buildApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, appUrl: env.APP_URL },
      `api listening on http://localhost:${env.PORT}`,
    );
  });

  if (env.QDRANT_URL) {
    void ensureQdrantCollection().catch((err: unknown) => {
      logger.error(
        { event: 'qdrant.bootstrap.failed', err: err instanceof Error ? err.message : String(err) },
        'Qdrant collection bootstrap failed at startup',
      );
    });
  } else {
    logger.warn(
      { event: 'qdrant.bootstrap.skipped' },
      'QDRANT_URL not configured — skipping collection bootstrap',
    );
  }

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown: received signal, refusing new connections');

    const forceExitAt = Date.now() + SHUTDOWN_DRAIN_MS;

    server.close((err) => {
      void Promise.allSettled([shutdownTracing(), closeRateLimiter()]).then(() => {
        if (err) {
          logger.error({ err: err.message }, 'shutdown: server.close failed');
          process.exit(1);
        }
        logger.info(
          { drainMs: Math.max(0, SHUTDOWN_DRAIN_MS - (forceExitAt - Date.now())) },
          'shutdown: server drained, exiting',
        );
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.warn({ drainMs: SHUTDOWN_DRAIN_MS }, 'shutdown: drain timeout exceeded, forcing exit');
      process.exit(1);
    }, SHUTDOWN_DRAIN_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(
      { reason: reason instanceof Error ? reason.stack : String(reason) },
      'unhandledRejection',
    );
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.stack ?? err.message }, 'uncaughtException — exiting');
    process.exit(1);
  });
}

const isEntry =
  typeof process.argv[1] === 'string' &&
  (import.meta.url.endsWith('/src/index.ts') ||
    import.meta.url.endsWith('/dist/index.js') ||
    process.argv[1].endsWith('index.ts') ||
    process.argv[1].endsWith('index.js'));

if (isEntry) {
  bootstrap();
}
