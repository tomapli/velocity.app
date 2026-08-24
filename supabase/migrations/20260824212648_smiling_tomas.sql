CREATE TYPE "public"."ig_scrape_data_source" AS ENUM('public', 'meta_hybrid');--> statement-breakpoint
CREATE TYPE "public"."meta_oauth_provider" AS ENUM('facebook', 'instagram');--> statement-breakpoint
CREATE TABLE "ig_account_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_profile_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metrics" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_account_insights_group_id_key" UNIQUE("group_id")
);
--> statement-breakpoint
ALTER TABLE "ig_account_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "meta_oauth_provider" NOT NULL,
	"external_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"account_picture_url" text,
	"access_token_ciphertext" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"last_validated_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_connections_provider_external_user_key" UNIQUE("provider","external_user_id")
);
--> statement-breakpoint
ALTER TABLE "meta_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_instagram_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"profile_picture_url" text,
	"page_id" text,
	"access_token_ciphertext" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_instagram_accounts_connection_user_key" UNIQUE("connection_id","ig_user_id")
);
--> statement-breakpoint
ALTER TABLE "meta_instagram_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "data_source" "ig_scrape_data_source" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "meta_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "meta_instagram_account_id" uuid;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "meta_media_id" text;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "follows_count" integer;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "follower_view_count" integer;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "non_follower_view_count" integer;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "follower_non_follower_ratio" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "reach_count" integer;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "hook_rate" numeric(7, 3);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "average_watch_time_ms" integer;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "hold_rate" numeric(7, 3);--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD COLUMN "follower_count" integer;--> statement-breakpoint
ALTER TABLE "ig_account_insights" ADD CONSTRAINT "ig_account_insights_profile_id_fkey" FOREIGN KEY ("ig_profile_id") REFERENCES "public"."ig_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_account_insights" ADD CONSTRAINT "ig_account_insights_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_instagram_accounts" ADD CONSTRAINT "meta_instagram_accounts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ig_account_insights_profile_captured_idx" ON "ig_account_insights" USING btree ("ig_profile_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meta_connections_last_used_at_idx" ON "meta_connections" USING btree ("last_used_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meta_instagram_accounts_username_idx" ON "meta_instagram_accounts" USING btree ("username");--> statement-breakpoint
CREATE INDEX "meta_instagram_accounts_connection_id_idx" ON "meta_instagram_accounts" USING btree ("connection_id");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_meta_connection_id_fkey" FOREIGN KEY ("meta_connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_meta_instagram_account_id_fkey" FOREIGN KEY ("meta_instagram_account_id") REFERENCES "public"."meta_instagram_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_meta_connection_id_idx" ON "groups" USING btree ("meta_connection_id");--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_meta_media_id_key" UNIQUE("meta_media_id");--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_follows_count_non_negative" CHECK (follows_count IS NULL OR follows_count >= 0);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_follower_view_count_non_negative" CHECK (follower_view_count IS NULL OR follower_view_count >= 0);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_non_follower_view_count_non_negative" CHECK (non_follower_view_count IS NULL OR non_follower_view_count >= 0);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_reach_count_non_negative" CHECK (reach_count IS NULL OR reach_count >= 0);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_average_watch_time_ms_non_negative" CHECK (average_watch_time_ms IS NULL OR average_watch_time_ms >= 0);--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_rates_non_negative" CHECK ((follower_non_follower_ratio IS NULL OR follower_non_follower_ratio >= 0)
        AND (hook_rate IS NULL OR hook_rate >= 0)
        AND (hold_rate IS NULL OR hold_rate >= 0));--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_follower_count_non_negative" CHECK (follower_count IS NULL OR follower_count >= 0);--> statement-breakpoint
CREATE POLICY "Authenticated users can view Instagram account insights" ON "ig_account_insights" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);