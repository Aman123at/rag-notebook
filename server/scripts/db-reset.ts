import { createInterface } from 'node:readline/promises';

import { z } from 'zod';

import { env } from '@/config/env.js';
import { closeDb, getSqlClient } from '@/db/client.js';

const PROTECTED_TABLES = new Set(['__drizzle_migrations']);

const tableRowsSchema = z.array(z.object({ tablename: z.string() }));

async function listTables(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = await sql`
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relispartition = false
    order by c.relname
  `;

  const parsed = tableRowsSchema.parse([...rows]);
  return parsed.map((r) => r.tablename).filter((t) => !PROTECTED_TABLES.has(t));
}

async function confirm(tables: string[]): Promise<boolean> {
  const auto = process.argv.slice(2).some((a) => a === '--yes' || a === '-y');
  if (auto) return true;
  if (!process.stdin.isTTY) {
    process.stderr.write('[db:reset] refusing: non-interactive shell without --yes.\n');
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `[db:reset] this will DELETE ALL ROWS from ${tables.length} table(s). Type "yes" to continue: `,
    );
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('db:reset is a dev-only script and refuses to run with NODE_ENV=production.');
  }

  const sql = getSqlClient();
  const tables = await listTables();
  if (tables.length === 0) {
    process.stdout.write('[db:reset] no tables found in schema "public" — nothing to do.\n');
    return;
  }

  process.stdout.write(`[db:reset] target: ${describeTarget(env.DATABASE_URL)}\n`);
  process.stdout.write(`[db:reset] tables: ${tables.join(', ')}\n`);

  if (!(await confirm(tables))) {
    process.stdout.write('[db:reset] aborted — nothing was deleted.\n');
    return;
  }

  const startedAt = Date.now();

  await sql`truncate table ${sql(tables)} restart identity cascade`;

  process.stdout.write(
    `[db:reset] emptied ${tables.length} table(s) in ${Date.now() - startedAt}ms. ` +
      'Structure, enums and migration history untouched. Run `pnpm db:seed` to re-seed.\n',
  );
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (err: unknown) => {
    process.stderr.write(
      `[db:reset] failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    await closeDb();
    process.exit(1);
  });
