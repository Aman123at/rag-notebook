import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryUuid, timestamps } from './_shared.js';
import { chats } from './chats.js';
import { chunks } from './chunks.js';
import { dislikedReasonEnum, finishReasonEnum, messageRoleEnum, reactionEnum } from './enums.js';
import { users } from './users.js';

export const messages = pgTable(
  'messages',
  {
    id: primaryUuid(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    modelName: text('model_name'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    consumedTokens: integer('consumed_tokens').notNull().default(0),
    responseOfMessageId: uuid('response_of_message_id').references((): AnyPgColumn => messages.id, {
      onDelete: 'set null',
    }),
    reaction: reactionEnum('reaction'),
    dislikedReason: dislikedReasonEnum('disliked_reason'),
    dislikedNote: text('disliked_note'),
    finishReason: finishReasonEnum('finish_reason'),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (t) => [index('messages_chat_created_at_idx').on(t.chatId, t.createdAt)],
);

export const messageReferences = pgTable(
  'message_references',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    chunkId: uuid('chunk_id')
      .notNull()
      .references(() => chunks.id, { onDelete: 'cascade' }),
    citationIndex: integer('citation_index').notNull(),

    score: numeric('score', { precision: 12, scale: 6 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.chunkId] })],
);

export const messageWebReferences = pgTable(
  'message_web_references',
  {
    id: primaryUuid(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    citationIndex: integer('citation_index').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    snippet: text('snippet').notNull(),
  },
  (t) => [index('message_web_references_message_idx').on(t.messageId)],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
export type MessageReferenceRow = typeof messageReferences.$inferSelect;
export type MessageWebReferenceRow = typeof messageWebReferences.$inferSelect;
