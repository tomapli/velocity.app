ALTER TABLE "ig_posts" ADD COLUMN "description_length" integer GENERATED ALWAYS AS (char_length(description)) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "engagement_rate" double precision GENERATED ALWAYS AS (CASE
        WHEN view_count > 0
          AND (like_count IS NOT NULL OR comment_count IS NOT NULL OR save_count IS NOT NULL OR share_count IS NOT NULL)
        THEN (COALESCE(like_count, 0) + COALESCE(comment_count, 0) + COALESCE(save_count, 0) + COALESCE(share_count, 0))::double precision * 100 / view_count
      END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "weighted_engagement_rate" double precision GENERATED ALWAYS AS (CASE
        WHEN view_count > 0
          AND (like_count IS NOT NULL OR comment_count IS NOT NULL OR save_count IS NOT NULL OR share_count IS NOT NULL)
        THEN (COALESCE(save_count, 0) * 4 + COALESCE(share_count, 0) * 3 + COALESCE(comment_count, 0) * 2 + COALESCE(like_count, 0))::double precision * 100 / view_count
      END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "save_rate" double precision GENERATED ALWAYS AS (CASE WHEN view_count > 0 AND save_count IS NOT NULL THEN save_count::double precision * 100 / view_count END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "share_rate" double precision GENERATED ALWAYS AS (CASE WHEN view_count > 0 AND share_count IS NOT NULL THEN share_count::double precision * 100 / view_count END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "comment_rate" double precision GENERATED ALWAYS AS (CASE WHEN view_count > 0 AND comment_count IS NOT NULL THEN comment_count::double precision * 100 / view_count END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "like_rate" double precision GENERATED ALWAYS AS (CASE WHEN view_count > 0 AND like_count IS NOT NULL THEN like_count::double precision * 100 / view_count END) STORED;--> statement-breakpoint
ALTER TABLE "ig_posts" ADD COLUMN "follows_per_1k_views" double precision GENERATED ALWAYS AS (CASE WHEN view_count > 0 AND follows_count IS NOT NULL THEN follows_count::double precision * 1000 / view_count END) STORED;