import { serve } from 'inngest/express';

import { env } from '@/config/env.js';
import { inngest } from '@/inngest/client.js';
import { inngestFunctions } from '@/inngest/functions/index.js';

export const INNGEST_SERVE_PATH = '/api/inngest';

export function buildInngestServeHandler(): ReturnType<typeof serve> {
  return serve({
    client: inngest,
    functions: inngestFunctions,
    ...(env.INNGEST_SIGNING_KEY ? { signingKey: env.INNGEST_SIGNING_KEY } : {}),
  });
}
