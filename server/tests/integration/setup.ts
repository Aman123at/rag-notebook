import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(HERE, '..', '..', 'drizzle');

const TEST_DB_NAME = 'rag_notebook_test';
export const TEST_DATABASE_URL = `postgres://postgres:postgres@localhost:5432/${TEST_DB_NAME}`;

export async function isDbReachable(): Promise<boolean> {
  const admin = postgres('postgres://postgres:postgres@localhost:5432/postgres', {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 2,
    onnotice: () => undefined,
  });
  try {
    await admin`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await admin.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function resetAndMigrate(): Promise<void> {
  const admin = postgres('postgres://postgres:postgres@localhost:5432/postgres', {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()`,
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await admin.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
