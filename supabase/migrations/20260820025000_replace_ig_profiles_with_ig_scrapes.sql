DROP POLICY "Authenticated users can view ig profiles" ON "ig_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can insert their own ig profiles" ON "ig_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can update ig profiles" ON "ig_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "ig_profiles" CASCADE;--> statement-breakpoint
DROP TYPE "public"."ig_profile_status";--> statement-breakpoint
ALTER TABLE "authorized_users" ADD COLUMN "picture_url" text;--> statement-breakpoint
CREATE TABLE "ig_scrapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"apify_called_at" timestamp with time zone,
	"apify_run_id" text,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"ig_username" text NOT NULL,
	"profile_picture_url" text,
	"ig_name" text,
	"description" text,
	"note" text,
	"post_count" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_scrapes_apify_run_id_key" UNIQUE("apify_run_id"),
	CONSTRAINT "ig_scrapes_ig_username_format" CHECK (ig_username = lower(ig_username) AND ig_username ~ '^[a-z0-9._]{1,30}$'),
	CONSTRAINT "ig_scrapes_post_count_non_negative" CHECK (post_count IS NULL OR post_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "ig_scrapes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_scrapes" ADD CONSTRAINT "ig_scrapes_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ig_scrapes_created_at_idx" ON "ig_scrapes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ig_scrapes_started_by_idx" ON "ig_scrapes" USING btree ("started_by");--> statement-breakpoint
CREATE POLICY "Authenticated users can view ig scrapes" ON "ig_scrapes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert their own ig scrapes" ON "ig_scrapes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = started_by));--> statement-breakpoint
CREATE POLICY "Authenticated users can update ig scrapes" ON "ig_scrapes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
