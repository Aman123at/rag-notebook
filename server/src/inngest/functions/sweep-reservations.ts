import { inngest } from '@/inngest/client.js';
import { logger } from '@/observability/logger.js';
import { sweepExpiredReservations } from '@/services/entitlements/index.js';

export const sweepReservationsFunction = inngest.createFunction(
  {
    id: 'sweep-reservations',
    name: 'Sweep expired token reservations',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const released = await step.run('sweep', async () => {
      return sweepExpiredReservations();
    });
    if (released > 0) {
      logger.info({ released }, 'reservations sweep released expired rows');
    }
    return { released };
  },
);
