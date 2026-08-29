import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { closeDb, getDb } from './client.js';

const MIGRATIONS_FOLDER = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'drizzle');

async function main(): Promise<void> {
  const db = getDb();
  const startedAt = Date.now();
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  process.stdout.write(
    `[db:migrate] applied migrations from ${path.relative(process.cwd(), MIGRATIONS_FOLDER)} in ${Date.now() - startedAt}ms.\n`,
  );
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (err: unknown) => {
    process.stderr.write(
      `[db:migrate] failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    await closeDb();
    process.exit(1);
  });
