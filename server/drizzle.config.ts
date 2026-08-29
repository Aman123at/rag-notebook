import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('drizzle-kit needs DATABASE_URL in the environment.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  strict: true,
  verbose: false,
  dbCredentials: { url },
});
