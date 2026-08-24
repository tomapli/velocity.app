CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_profile_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"requested_post_count" integer,
	"since_when" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_requested_post_count_non_negative" CHECK (requested_post_count IS NULL OR requested_post_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "Authenticated users can view items" ON "items" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can insert their own items" ON "items" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can delete items" ON "items" CASCADE;--> statement-breakpoint
DROP TABLE "items" CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_ig_profile_id_fkey" FOREIGN KEY ("ig_profile_id") REFERENCES "public"."ig_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_created_at_idx" ON "groups" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "groups_ig_profile_id_idx" ON "groups" USING btree ("ig_profile_id");--> statement-breakpoint
CREATE INDEX "groups_created_by_idx" ON "groups" USING btree ("created_by");--> statement-breakpoint
CREATE POLICY "Authenticated users can view groups" ON "groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert their own groups" ON "groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));