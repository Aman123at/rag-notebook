import { z } from 'zod';

import { defineRouteDefinition } from '../common/route.js';
import { DislikedReasonSchema, ReactionSchema } from '../domain/enums.js';

import { MessageSchema } from './chats.js';








export const MessageReactionBodySchema = z
  .object({
    reaction: ReactionSchema.nullable(),
    dislikedReason: DislikedReasonSchema.optional(),
    dislikedNote: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.reaction === 'like' && val.dislikedReason !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '`dislikedReason` is only allowed on dislike reactions.',
        path: ['dislikedReason'],
      });
    }
    if (val.reaction === 'dislike' && val.dislikedReason === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '`dislikedReason` is required on dislike reactions.',
        path: ['dislikedReason'],
      });
    }
    if (val.reaction === null && (val.dislikedReason !== undefined || val.dislikedNote !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Clearing a reaction cannot carry a reason or note.',
        path: ['reaction'],
      });
    }
  });

export const MessageParamsSchema = z.object({ messageId: z.string().uuid() });

export const messagesRoutes = {
  'messages.reaction': defineRouteDefinition({
    method: 'POST',
    path: '/messages/:messageId/reaction',
    auth: 'required',
    params: MessageParamsSchema,
    query: z.object({}),
    body: MessageReactionBodySchema,
    response: MessageSchema,
    errors: [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ],
    tags: ['messages'],
    summary: 'Set, change, or clear a reaction on an assistant message.',
  }),
} as const;
