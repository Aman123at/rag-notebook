



CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE "public"."attack_detector" AS ENUM('REGEX', 'CLASSIFIER');
CREATE TYPE "public"."attack_stage" AS ENUM('INGESTION', 'QUERY');
CREATE TYPE "public"."attack_type" AS ENUM('PROMPT_INJECTION', 'JAILBREAK', 'SYSTEM_PROMPT_EXTRACTION', 'POISONED_DOCUMENT');
CREATE TYPE "public"."chat_model" AS ENUM('gpt-4o-mini', 'gpt-4o');
CREATE TYPE "public"."disliked_reason" AS ENUM('INAPPROPRIATE', 'HALLUCINATED', 'INCOMPLETE', 'OFF_TOPIC', 'OTHER');
CREATE TYPE "public"."finish_reason" AS ENUM('stop', 'length', 'tool', 'aborted');
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
CREATE TYPE "public"."plan_tier" AS ENUM('FREE', 'PRO', 'CUSTOM');
CREATE TYPE "public"."reaction" AS ENUM('like', 'dislike');
CREATE TYPE "public"."source_status" AS ENUM('PENDING', 'UPLOADED', 'EXTRACTING', 'EXTRACTED', 'SCANNING', 'CHUNKING', 'CHUNKED', 'INDEXING', 'READY', 'QUARANTINED', 'FAILED');
CREATE TYPE "public"."source_type" AS ENUM('PDF', 'TEXT', 'VTT', 'WEB_URL', 'YOUTUBE_VIDEO', 'YOUTUBE_PLAYLIST');
CREATE TYPE "public"."subscription_provider" AS ENUM('RAZORPAY');
CREATE TYPE "public"."subscription_status" AS ENUM('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'REFUNDED');
CREATE TYPE "public"."token_reservation_kind" AS ENUM('COMPLETION', 'EMBEDDING');
CREATE TYPE "public"."token_reservation_status" AS ENUM('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED');
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"content" jsonb NOT NULL,
	"model_name" text,
	"consumed_tokens" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "attack_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"attack_type" "attack_type" NOT NULL,
	"stage" "attack_stage" NOT NULL,
	"message_id" uuid,
	"source_id" uuid,
	"attempt_number" integer NOT NULL,
	"detector" "attack_detector" NOT NULL,
	"matched_rules" text[] NOT NULL,
	"excerpt" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"availed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens_granted" bigint NOT NULL
);

CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext" NOT NULL,
	"token_amount" bigint NOT NULL,
	"valid_till" timestamp with time zone,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan_tier" NOT NULL,
	"provider" "subscription_provider" NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_payment_id" text,
	"status" "subscription_status" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"summary_updated_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"public_slug" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"locator" jsonb NOT NULL,
	"locator_kind" text GENERATED ALWAYS AS ((locator ->> 'kind')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"doc_length" bigint
);

CREATE TABLE "message_references" (
	"message_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"citation_index" integer NOT NULL,
	"score" numeric(12, 6) NOT NULL,
	CONSTRAINT "message_references_message_id_chunk_id_pk" PRIMARY KEY("message_id","chunk_id")
);

CREATE TABLE "message_web_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"citation_index" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text NOT NULL
);

CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"model_name" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"consumed_tokens" integer DEFAULT 0 NOT NULL,
	"response_of_message_id" uuid,
	"reaction" "reaction",
	"disliked_reason" "disliked_reason",
	"disliked_note" text,
	"finish_reason" "finish_reason",
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_source_id" uuid,
	"type" "source_type" NOT NULL,
	"status" "source_status" DEFAULT 'PENDING' NOT NULL,
	"title" text NOT NULL,
	"original_ref" text NOT NULL,
	"media_id" text,
	"storage_public_id" text,
	"mime_type" text,
	"size_bytes" bigint,
	"content_hash" text,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"failure_retryable" boolean,
	"security_flags" jsonb,
	"metadata" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "token_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"kind" "token_reservation_kind" NOT NULL,
	"estimated_tokens" bigint NOT NULL,
	"status" "token_reservation_status" DEFAULT 'RESERVED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lexical_df" (
	"term_hash" bigint PRIMARY KEY NOT NULL,
	"doc_freq" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lexical_stats" (
	"id" integer PRIMARY KEY NOT NULL,
	"total_docs" bigint DEFAULT 0::bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "usage_daily" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"embedding_tokens" bigint DEFAULT 0::bigint NOT NULL,
	"completion_tokens" bigint DEFAULT 0::bigint NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_daily_user_id_date_pk" PRIMARY KEY("user_id","date")
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text,
	"sign_up_type" text,
	"plan_tier" "plan_tier" DEFAULT 'FREE' NOT NULL,
	"assigned_tokens" bigint,
	"used_tokens_embedding" bigint DEFAULT 0::bigint NOT NULL,
	"used_tokens_completion" bigint DEFAULT 0::bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_at" timestamp with time zone,
	"blocked_reason" text,
	"plan_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attack_attempts" ADD CONSTRAINT "attack_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attack_attempts" ADD CONSTRAINT "attack_attempts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "attack_attempts" ADD CONSTRAINT "attack_attempts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chats" ADD CONSTRAINT "chats_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "message_references" ADD CONSTRAINT "message_references_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "message_references" ADD CONSTRAINT "message_references_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "message_web_references" ADD CONSTRAINT "message_web_references_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_response_of_message_id_messages_id_fk" FOREIGN KEY ("response_of_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sources" ADD CONSTRAINT "sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sources" ADD CONSTRAINT "sources_parent_source_id_sources_id_fk" FOREIGN KEY ("parent_source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "token_reservations" ADD CONSTRAINT "token_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "token_reservations" ADD CONSTRAINT "token_reservations_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "attack_attempts_user_idx" ON "attack_attempts" USING btree ("user_id","attempted_at");
CREATE INDEX "attack_attempts_source_idx" ON "attack_attempts" USING btree ("source_id");
CREATE UNIQUE INDEX "coupon_redemptions_coupon_user_key" ON "coupon_redemptions" USING btree ("coupon_id","user_id");
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons" USING btree ("code");
CREATE UNIQUE INDEX "subscriptions_provider_order_key" ON "subscriptions" USING btree ("provider","provider_order_id");
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id","status");
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events" USING btree ("provider","event_id");
CREATE UNIQUE INDEX "chats_public_slug_key" ON "chats" USING btree ("public_slug") WHERE "chats"."public_slug" IS NOT NULL;
CREATE UNIQUE INDEX "chunks_source_chunk_index_key" ON "chunks" USING btree ("source_id","chunk_index");
CREATE INDEX "chunks_source_id_idx" ON "chunks" USING btree ("source_id");
CREATE INDEX "chunks_workspace_id_idx" ON "chunks" USING btree ("workspace_id");
CREATE INDEX "chunks_locator_kind_idx" ON "chunks" USING btree ("locator_kind");
CREATE INDEX "message_web_references_message_idx" ON "message_web_references" USING btree ("message_id");
CREATE INDEX "messages_chat_created_at_idx" ON "messages" USING btree ("chat_id","created_at");
CREATE INDEX "sources_workspace_id_live_idx" ON "sources" USING btree ("workspace_id") WHERE "sources"."deleted_at" IS NULL;
CREATE INDEX "sources_user_status_idx" ON "sources" USING btree ("user_id","status");
CREATE INDEX "sources_parent_source_id_idx" ON "sources" USING btree ("parent_source_id");
CREATE INDEX "sources_workspace_content_hash_idx" ON "sources" USING btree ("workspace_id","content_hash");
CREATE INDEX "token_reservations_user_status_idx" ON "token_reservations" USING btree ("user_id","status");
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users" USING btree ("clerk_user_id");
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");
CREATE INDEX "users_plan_tier_idx" ON "users" USING btree ("plan_tier");
CREATE UNIQUE INDEX "workspaces_user_lower_name_unique" ON "workspaces" USING btree ("user_id",lower("name")) WHERE "workspaces"."deleted_at" IS NULL;