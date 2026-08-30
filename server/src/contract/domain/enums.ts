import { z } from 'zod';


export const PLAN_TIERS = ['FREE', 'PRO', 'CUSTOM'] as const;
export const PlanTierSchema = z.enum(PLAN_TIERS);
export type PlanTier = z.infer<typeof PlanTierSchema>;


export const SOURCE_TYPES = [
  'PDF',
  'TEXT',
  'VTT',
  'WEB_URL',
  'YOUTUBE_VIDEO',
  'YOUTUBE_PLAYLIST',
] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;


export const SOURCE_STATUSES = [
  'PENDING',
  'UPLOADED',
  'EXTRACTING',
  'EXTRACTED',
  'SCANNING',
  'CHUNKING',
  'CHUNKED',
  'INDEXING',
  'READY',
  'QUARANTINED',
  'FAILED',
] as const;
export const SourceStatusSchema = z.enum(SOURCE_STATUSES);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;


export const SOURCE_DISPLAY_STATUSES = ['uploading', 'processing', 'indexed', 'failed'] as const;
export const SourceDisplayStatusSchema = z.enum(SOURCE_DISPLAY_STATUSES);
export type SourceDisplayStatus = z.infer<typeof SourceDisplayStatusSchema>;






export function toDisplayStatus(status: SourceStatus): SourceDisplayStatus {
  switch (status) {
    case 'PENDING':
    case 'UPLOADED':
      return 'uploading';
    case 'EXTRACTING':
    case 'EXTRACTED':
    case 'SCANNING':
    case 'CHUNKING':
    case 'CHUNKED':
    case 'INDEXING':
      return 'processing';
    case 'READY':
      return 'indexed';
    case 'QUARANTINED':
    case 'FAILED':
      return 'failed';
  }
}


export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof MessageRoleSchema>;


export const REACTIONS = ['like', 'dislike'] as const;
export const ReactionSchema = z.enum(REACTIONS);
export type Reaction = z.infer<typeof ReactionSchema>;


export const DISLIKED_REASONS = [
  'INAPPROPRIATE',
  'HALLUCINATED',
  'INCOMPLETE',
  'OFF_TOPIC',
  'OTHER',
] as const;
export const DislikedReasonSchema = z.enum(DISLIKED_REASONS);
export type DislikedReason = z.infer<typeof DislikedReasonSchema>;


export const CHAT_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const;
export const ChatModelSchema = z.enum(CHAT_MODELS);
export type ChatModel = z.infer<typeof ChatModelSchema>;


export const FINISH_REASONS = ['stop', 'length', 'tool', 'aborted'] as const;
export const FinishReasonSchema = z.enum(FINISH_REASONS);
export type FinishReason = z.infer<typeof FinishReasonSchema>;
