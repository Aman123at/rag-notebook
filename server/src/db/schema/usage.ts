import { sql } from 'drizzle-orm';
import { bigint, date, integer, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const usageDaily = pgTable(
  'usage_daily',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    embeddingTokens: bigint('embedding_tokens', { mode: 'bigint' })
      .notNull()
      .default(sql`0::bigint`),
    completionTokens: bigint('completion_tokens', { mode: 'bigint' })
      .notNull()
      .default(sql`0::bigint`),
    requestCount: integer('request_count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const lexicalDf = pgTable('lexical_df', {
  termHash: bigint('term_hash', { mode: 'bigint' }).primaryKey(),
  docFreq: bigint('doc_freq', { mode: 'bigint' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const lexicalStats = pgTable('lexical_stats', {
  id: integer('id').primaryKey(),
  totalDocs: bigint('total_docs', { mode: 'bigint' })
    .notNull()
    .default(sql`0::bigint`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type UsageDailyRow = typeof usageDaily.$inferSelect;
export type LexicalDfRow = typeof lexicalDf.$inferSelect;
export type LexicalStatsRow = typeof lexicalStats.$inferSelect;
