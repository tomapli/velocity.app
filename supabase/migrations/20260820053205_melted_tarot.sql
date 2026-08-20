CREATE TYPE "public"."scheduled_scrape_type" AS ENUM('posts', 'reels', 'post_details');--> statement-breakpoint
CREATE TABLE "scheduled_scrapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_profile_id" uuid NOT NULL,
	"started_by" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"scrape_type" "scheduled_scrape_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"apify_called_at" timestamp with time zone,
	"apify_run_id" text,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"requested_post_count" integer,
	"since_when" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_scrapes_apify_run_id_key" UNIQUE("apify_run_id"),
	CONSTRAINT "scheduled_scrapes_requested_post_count_non_negative" CHECK (requested_post_count IS NULL OR requested_post_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_scrapes" RENAME TO "ig_profiles";--> statement-breakpoint
ALTER TABLE "ig_posts" RENAME COLUMN "ig_scrape_id" TO "ig_profile_id";--> statement-breakpoint
ALTER TABLE "ig_profiles" RENAME COLUMN "started_by" TO "created_by";--> statement-breakpoint
ALTER TABLE "ig_posts" DROP CONSTRAINT "ig_posts_ig_scrape_id_post_url_key";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP CONSTRAINT "ig_scrapes_apify_run_id_key";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP CONSTRAINT "ig_scrapes_ig_username_format";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP CONSTRAINT "ig_scrapes_post_count_non_negative";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP CONSTRAINT "ig_scrapes_requested_post_count_non_negative";--> statement-breakpoint
ALTER TABLE "ig_posts" DROP CONSTRAINT "ig_posts_ig_scrape_id_fkey";
--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP CONSTRAINT "ig_scrapes_started_by_fkey";
--> statement-breakpoint
DROP INDEX "ig_posts_ig_scrape_id_idx";--> statement-breakpoint
DROP INDEX "ig_scrapes_created_at_idx";--> statement-breakpoint
DROP INDEX "ig_scrapes_started_by_idx";--> statement-breakpoint
ALTER TABLE "ig_posts" ALTER COLUMN "uploaded_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ig_posts" ALTER COLUMN "media_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "source_scrape_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "details_scrape_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ADD CONSTRAINT "scheduled_scrapes_ig_profile_id_fkey" FOREIGN KEY ("ig_profile_id") REFERENCES "public"."ig_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ADD CONSTRAINT "scheduled_scrapes_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_scrapes_created_at_idx" ON "scheduled_scrapes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scheduled_scrapes_group_id_idx" ON "scheduled_scrapes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "scheduled_scrapes_ig_profile_id_idx" ON "scheduled_scrapes" USING btree ("ig_profile_id");--> statement-breakpoint
CREATE INDEX "scheduled_scrapes_started_by_idx" ON "scheduled_scrapes" USING btree ("started_by");--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_ig_profile_id_fkey" FOREIGN KEY ("ig_profile_id") REFERENCES "public"."ig_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_source_scrape_id_fkey" FOREIGN KEY ("source_scrape_id") REFERENCES "public"."scheduled_scrapes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_details_scrape_id_fkey" FOREIGN KEY ("details_scrape_id") REFERENCES "public"."scheduled_scrapes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ig_posts_ig_profile_id_idx" ON "ig_posts" USING btree ("ig_profile_id");--> statement-breakpoint
CREATE INDEX "ig_posts_source_scrape_id_idx" ON "ig_posts" USING btree ("source_scrape_id");--> statement-breakpoint
CREATE INDEX "ig_posts_details_scrape_id_idx" ON "ig_posts" USING btree ("details_scrape_id");--> statement-breakpoint
CREATE INDEX "ig_profiles_created_at_idx" ON "ig_profiles" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ig_profiles_created_by_idx" ON "ig_profiles" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "apify_called_at";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "apify_run_id";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "finished_at";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "error_message";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "requested_post_count";--> statement-breakpoint
ALTER TABLE "ig_profiles" DROP COLUMN "since_when";--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_ig_profile_id_post_url_key" UNIQUE("ig_profile_id","post_url");--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_ig_username_key" UNIQUE("ig_username");--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_ig_username_format" CHECK (ig_username = lower(ig_username) AND ig_username ~ '^[a-z0-9._]{1,30}$');--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_post_count_non_negative" CHECK (post_count IS NULL OR post_count >= 0);--> statement-breakpoint
DROP POLICY "Authenticated users can view ig scrapes" ON "ig_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can insert their own ig scrapes" ON "ig_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can update ig scrapes" ON "ig_profiles" CASCADE;--> statement-breakpoint
CREATE POLICY "Authenticated users can view ig profiles" ON "ig_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert ig profiles" ON "ig_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));--> statement-breakpoint
CREATE POLICY "Authenticated users can update ig profiles" ON "ig_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can view scheduled scrapes" ON "scheduled_scrapes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert their own scheduled scrapes" ON "scheduled_scrapes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = started_by));--> statement-breakpoint
CREATE POLICY "Authenticated users can update their own scheduled scrapes" ON "scheduled_scrapes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = started_by)) WITH CHECK ((( SELECT auth.uid() AS uid) = started_by));--> statement-breakpoint
ALTER POLICY "Authenticated users can insert ig posts for their scrapes" ON "ig_posts" TO authenticated WITH CHECK (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
ALTER POLICY "Authenticated users can update ig posts for their scrapes" ON "ig_posts" TO authenticated USING (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      ));