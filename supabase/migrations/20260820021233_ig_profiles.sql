CREATE TYPE "public"."ig_profile_status" AS ENUM('idle', 'waiting', 'scraping', 'ready', 'error');--> statement-breakpoint
CREATE TABLE "ig_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"status" "ig_profile_status" DEFAULT 'idle' NOT NULL,
	"source_url" text,
	"searched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_profiles_username_key" UNIQUE("username"),
	CONSTRAINT "ig_profiles_username_format" CHECK (username = lower(username) AND username ~ '^[a-z0-9._]{1,30}$')
);
--> statement-breakpoint
ALTER TABLE "ig_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_profiles" ADD CONSTRAINT "ig_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ig_profiles_searched_at_idx" ON "ig_profiles" USING btree ("searched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "Authenticated users can view ig profiles" ON "ig_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert their own ig profiles" ON "ig_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));--> statement-breakpoint
CREATE POLICY "Authenticated users can update ig profiles" ON "ig_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);