CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_title_length" CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 200)
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_created_at_idx" ON "items" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "Authenticated users can view items" ON "items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert their own items" ON "items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));--> statement-breakpoint
CREATE POLICY "Authenticated users can delete items" ON "items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);