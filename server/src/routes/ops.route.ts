import { execSync } from 'node:child_process';

import { CURRENT_CONTRACT_VERSION } from '@/contract/index.js';
import { checkDbConnection } from '@/db/client.js';
import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import { checkQdrant } from '@/integrations/qdrant.js';

function readGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

const BOOT_INFO = Object.freeze({
  version: CURRENT_CONTRACT_VERSION,
  gitSha: readGitSha(),
  generatedAt: new Date().toISOString(),
});

const PROCESS_STARTED_AT_MS = Date.now();

const healthz: DefinedRoute = defineRoute('ops.healthz', () => ({
  status: 'ok' as const,
  version: BOOT_INFO.version,
  uptimeSeconds: Math.max(0, (Date.now() - PROCESS_STARTED_AT_MS) / 1000),
}));

const readyz: DefinedRoute = defineRoute('ops.readyz', async () => {
  const [db, qdrant] = await Promise.all([checkDbConnection(), checkQdrant()]);

  const status: 'ok' | 'degraded' | 'down' = db.ok && qdrant.ok ? 'ok' : 'down';
  return {
    status,
    checks: {
      db: { ok: db.ok, latencyMs: db.latencyMs, message: db.message },
      qdrant: { ok: qdrant.ok, latencyMs: qdrant.latencyMs, message: qdrant.message },
    },
  };
});

const contractMeta: DefinedRoute = defineRoute('ops.contract', () => BOOT_INFO);

export const opsRealRoutes: readonly DefinedRoute[] = [healthz, readyz, contractMeta];
