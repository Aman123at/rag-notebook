CREATE TYPE "public"."podcast_stale_reason" AS ENUM('SOURCES_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."podcast_status" AS ENUM('PENDING', 'SCRIPTING', 'SYNTHESIZING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TABLE "podcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "podcast_status" DEFAULT 'PENDING' NOT NULL,
	"audio_public_id" text,
	"duration_seconds" integer,
	"script" jsonb,
	"script_model" text,
	"tts_model" text,
	"consumed_tokens" bigint,
	"is_stale" boolean DEFAULT false NOT NULL,
	"stale_reason" "podcast_stale_reason",
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "podcasts_workspace_unique" ON "podcasts" USING btree ("workspace_id");