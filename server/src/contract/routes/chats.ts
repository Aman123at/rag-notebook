import { z } from 'zod';

import { PaginationQuerySchema } from '../common/pagination.js';
import { defineRouteDefinition } from '../common/route.js';
import { CitationSchema, WebCitationSchema } from '../domain/citation.js';
import {
  ChatModelSchema,
  DislikedReasonSchema,
  MessageRoleSchema,
  ReactionSchema,
} from '../domain/enums.js';
import { ChatStreamEventSchema } from '../sse/chat-stream.js';

export const ChatSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  summaryUpdatedAt: z.string().datetime().nullable(),
  messageCount: z.number().int().nonnegative(),
  isArchived: z.boolean(),
  isPublic: z.boolean(),
  publicSlug: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Chat = z.infer<typeof ChatSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  modelName: z.string().nullable(),
  consumedTokens: z.number().int().nonnegative(),
  reaction: ReactionSchema.nullable(),
  dislikedReason: DislikedReasonSchema.nullable(),
  responseOfMessageId: z.string().uuid().nullable(),
  citations: z.array(CitationSchema),
  webCitations: z.array(WebCitationSchema),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CreateChatBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export const UpdateChatBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});







export const SendMessageInputSchema = z.object({
  content: z.string().min(1),
  webSearch: z.boolean().optional(),
  model: ChatModelSchema.optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const WorkspaceIdParamsSchema = z.object({ workspaceId: z.string().uuid() });
export const ChatParamsSchema = z.object({ chatId: z.string().uuid() });

export const chatsRoutes = {
  'chats.list': defineRouteDefinition({
    method: 'GET',
    path: '/workspaces/:workspaceId/chats',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: PaginationQuerySchema,
    body: z.object({}),
    response: z.array(ChatSchema),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR'],
    tags: ['chats'],
    summary: 'List chats in a workspace, paginated.',
  }),
  'chats.create': defineRouteDefinition({
    method: 'POST',
    path: '/workspaces/:workspaceId/chats',
    auth: 'required',
    params: WorkspaceIdParamsSchema,
    query: z.object({}),
    body: CreateChatBodySchema,
    response: ChatSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ],
    tags: ['chats'],
    summary: 'Create a chat inside a workspace.',
  }),
  'chats.get': defineRouteDefinition({
    method: 'GET',
    path: '/chats/:chatId',
    auth: 'required',
    params: ChatParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: ChatSchema,
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['chats'],
    summary: 'Get one chat.',
  }),
  'chats.update': defineRouteDefinition({
    method: 'PATCH',
    path: '/chats/:chatId',
    auth: 'required',
    params: ChatParamsSchema,
    query: z.object({}),
    body: UpdateChatBodySchema,
    response: ChatSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CONFLICT',
      'INTERNAL_ERROR',
    ],
    tags: ['chats'],
    summary: 'Rename, archive, or publish a chat.',
  }),
  'chats.delete': defineRouteDefinition({
    method: 'DELETE',
    path: '/chats/:chatId',
    auth: 'required',
    params: ChatParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['chats'],
    summary: 'Soft-delete a chat.',
  }),
  'chats.messages': defineRouteDefinition({
    method: 'GET',
    path: '/chats/:chatId/messages',
    auth: 'required',
    params: ChatParamsSchema,
    query: z.object({}),
    body: z.object({}),
    response: z.array(MessageSchema),
    errors: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'],
    tags: ['chats'],
    summary: 'List messages in a chat (oldest → newest).',
  }),
  'chats.sendMessage': defineRouteDefinition({
    method: 'POST',
    path: '/chats/:chatId/messages',
    auth: 'required',
    params: ChatParamsSchema,
    query: z.object({}),
    body: SendMessageInputSchema,
    response: ChatStreamEventSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'PROMPT_TOO_LONG',
      'TOKEN_QUOTA_EXCEEDED',
      'PLAN_LIMIT_EXCEEDED',
      'SECURITY_VIOLATION',
      'USER_BLOCKED',
      'SOURCE_NOT_READY',
      'RATE_LIMITED',
      'UPSTREAM_ERROR',
      'INTERNAL_ERROR',
    ],
    tags: ['chats', 'sse'],
    summary: 'Send a message; stream the assistant answer as chat SSE events.',
    responseContentType: 'text/event-stream',
  }),
} as const;
