ALTER TABLE "ig_scrapes" ADD COLUMN "requested_post_count" integer;--> statement-breakpoint
ALTER TABLE "ig_scrapes" ADD COLUMN "since_when" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ig_scrapes" ADD CONSTRAINT "ig_scrapes_requested_post_count_non_negative" CHECK (requested_post_count IS NULL OR requested_post_count >= 0);