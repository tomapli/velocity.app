CREATE TYPE "public"."ig_scrape_method" AS ENUM('apify_instagram_scraper', 'data_slayer_instagram_posts');--> statement-breakpoint
ALTER TYPE "public"."scheduled_scrape_type" ADD VALUE 'profile_posts';--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "scrape_method" "ig_scrape_method" DEFAULT 'apify_instagram_scraper' NOT NULL;