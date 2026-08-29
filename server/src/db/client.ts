import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { env } from '@/config/env.js';
import * as schema from '@/db/schema/index.js';

export type DbSchema = typeof schema;
export type Db = PostgresJsDatabase<DbSchema>;

export type Executor = Db;

let sqlHandle: Sql | undefined;
let dbHandle: Db | undefined;

export function getSqlClient(): Sql {
  if (sqlHandle) return sqlHandle;
  sqlHandle = postgres(env.DATABASE_URL, {
    max: env.DB_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,

    connection: { statement_timeout: env.DB_STATEMENT_TIMEOUT_MS },
  });
  return sqlHandle;
}

export function getDb(): Db {
  if (dbHandle) return dbHandle;
  dbHandle = drizzle(getSqlClient(), { schema, casing: 'snake_case' });
  return dbHandle;
}

export function exec(tx?: Executor): Executor {
  return tx ?? getDb();
}

export async function withTransaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => fn(tx as Executor));
}

export async function checkDbConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string | null;
}> {
  const startedAt = Date.now();
  try {
    const sql = getSqlClient();
    await sql`select 1`;
    return { ok: true, latencyMs: Date.now() - startedAt, message: null };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pingOrThrow(): Promise<void> {
  const sql = getSqlClient();
  await sql`select 1`;
}

export async function closeDb(): Promise<void> {
  if (sqlHandle) {
    await sqlHandle.end({ timeout: 5 });
    sqlHandle = undefined;
    dbHandle = undefined;
  }
}

export { schema };
