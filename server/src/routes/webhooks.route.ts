import { Webhook } from 'svix';

import { env } from '@/config/env.js';
import { AppError } from '@/errors/AppError.js';
import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { handleClerkWebhookEvent } from '@/services/users.service.js';

interface ClerkWebhookEnvelope {
  type: string;
  data: Record<string, unknown>;
}

const clerkWebhook: DefinedRoute = defineRoute('identity.clerkWebhook', async (ctx) => {
  const secret = env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError('INTERNAL_ERROR', 'CLERK_WEBHOOK_SECRET is not configured.', {
      exposeDetails: false,
    });
  }

  const raw = (ctx.req as unknown as { rawBody?: Buffer }).rawBody;
  if (!raw || !Buffer.isBuffer(raw)) {
    ctx.log.error(
      { requestId: ctx.requestId },
      'webhook: req.rawBody missing — express.json verify callback not mounted',
    );
    throw new AppError('INTERNAL_ERROR', 'Webhook raw body missing.', {
      exposeDetails: false,
    });
  }
  const payload = raw.toString('utf8');

  const headers = {
    'svix-id': String(ctx.req.header('svix-id') ?? ''),
    'svix-timestamp': String(ctx.req.header('svix-timestamp') ?? ''),
    'svix-signature': String(ctx.req.header('svix-signature') ?? ''),
  };
  if (!headers['svix-id'] || !headers['svix-timestamp'] || !headers['svix-signature']) {
    throw new AppError('UNAUTHENTICATED', 'Missing svix headers.', { exposeDetails: false });
  }

  let verified: ClerkWebhookEnvelope;
  try {
    const wh = new Webhook(secret);
    const raw: unknown = wh.verify(payload, headers);
    verified = raw as ClerkWebhookEnvelope;
  } catch (err) {
    ctx.log.warn(
      { requestId: ctx.requestId, cause: err instanceof Error ? err.message : String(err) },
      'clerk webhook signature verification failed',
    );
    throw new AppError('UNAUTHENTICATED', 'Webhook signature verification failed.', {
      exposeDetails: false,
    });
  }

  await handleClerkWebhookEvent({
    svixId: headers['svix-id'],
    envelope: verified,
    requestId: ctx.requestId,
  });
  return { received: true as const };
});

export const webhooksRealRoutes: readonly DefinedRoute[] = [clerkWebhook];
