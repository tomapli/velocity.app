CREATE TYPE "public"."ig_post_media_type" AS ENUM('carousel', 'short', 'static');--> statement-breakpoint
CREATE TABLE "ig_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_scrape_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"thumbnail_url" text,
	"post_url" text NOT NULL,
	"first_frame_url" text,
	"video_embed_url" text,
	"media_type" "ig_post_media_type" NOT NULL,
	"carousel_image_urls" text[],
	"video_length_secs" integer,
	"view_count" integer,
	"save_count" integer,
	"share_count" integer,
	"comment_count" integer,
	"like_count" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_posts_ig_scrape_id_post_url_key" UNIQUE("ig_scrape_id","post_url"),
	CONSTRAINT "ig_posts_post_url_length" CHECK (char_length(trim(post_url)) >= 1 AND char_length(post_url) <= 2048),
	CONSTRAINT "ig_posts_video_length_secs_non_negative" CHECK (video_length_secs IS NULL OR video_length_secs >= 0),
	CONSTRAINT "ig_posts_view_count_non_negative" CHECK (view_count IS NULL OR view_count >= 0),
	CONSTRAINT "ig_posts_save_count_non_negative" CHECK (save_count IS NULL OR save_count >= 0),
	CONSTRAINT "ig_posts_share_count_non_negative" CHECK (share_count IS NULL OR share_count >= 0),
	CONSTRAINT "ig_posts_comment_count_non_negative" CHECK (comment_count IS NULL OR comment_count >= 0),
	CONSTRAINT "ig_posts_like_count_non_negative" CHECK (like_count IS NULL OR like_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "ig_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD CONSTRAINT "ig_posts_ig_scrape_id_fkey" FOREIGN KEY ("ig_scrape_id") REFERENCES "public"."ig_scrapes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ig_posts_ig_scrape_id_idx" ON "ig_posts" USING btree ("ig_scrape_id");--> statement-breakpoint
CREATE INDEX "ig_posts_uploaded_at_idx" ON "ig_posts" USING btree ("uploaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "Authenticated users can view ig posts" ON "ig_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can insert ig posts for their scrapes" ON "ig_posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1
        FROM public.ig_scrapes
        WHERE ig_scrapes.id = ig_scrape_id
          AND ig_scrapes.started_by = (SELECT auth.uid() AS uid)
      ));--> statement-breakpoint
CREATE POLICY "Authenticated users can update ig posts for their scrapes" ON "ig_posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1
        FROM public.ig_scrapes
        WHERE ig_scrapes.id = ig_scrape_id
          AND ig_scrapes.started_by = (SELECT auth.uid() AS uid)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM public.ig_scrapes
        WHERE ig_scrapes.id = ig_scrape_id
          AND ig_scrapes.started_by = (SELECT auth.uid() AS uid)
      ));
