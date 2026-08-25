ALTER TYPE "public"."scheduled_scrape_type" ADD VALUE 'meta';--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ADD COLUMN "state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_scrapes" ADD CONSTRAINT "scheduled_scrapes_state_is_object" CHECK (jsonb_typeof("scheduled_scrapes"."state") = 'object');