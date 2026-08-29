import { Inngest } from 'inngest';

import { env } from '@/config/env.js';

export const inngest = new Inngest({
  id: 'rag-notebook-server',
  ...(env.INNGEST_EVENT_KEY ? { eventKey: env.INNGEST_EVENT_KEY } : {}),
  isDev: env.INNGEST_DEV,
});

export type InngestClient = typeof inngest;
