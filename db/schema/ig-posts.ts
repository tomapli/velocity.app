// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  pgEnum,
  foreignKey,
  pgPolicy,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  doublePrecision,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { igProfiles } from "./ig-profiles";
import { scheduledScrapes } from "./scheduled-scrapes";

export const igPostMediaType = pgEnum("ig_post_media_type", [
  "carousel",
  "short",
  "static",
]);

export const igPosts = pgTable(
  "ig_posts",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    igProfileId: uuid("ig_profile_id").notNull(),
    sourceScrapeId: uuid("source_scrape_id").notNull(),
    detailsScrapeId: uuid("details_scrape_id"),
    uploadedAt: timestamp("uploaded_at", {
      withTimezone: true,
      mode: "string",
    }),
    thumbnailUrl: text("thumbnail_url"),
    postUrl: text("post_url").notNull(),
    firstFrameUrl: text("first_frame_url"),
    videoEmbedUrl: text("video_embed_url"),
    mediaType: igPostMediaType("media_type"),
    carouselImageUrls: text("carousel_image_urls").array(),
    videoLengthSecs: integer("video_length_secs"),
    viewCount: integer("view_count"),
    saveCount: integer("save_count"),
    shareCount: integer("share_count"),
    commentCount: integer("comment_count"),
    likeCount: integer("like_count"),
    metaMediaId: text("meta_media_id"),
    followsCount: integer("follows_count"),
    followerViewCount: integer("follower_view_count"),
    nonFollowerViewCount: integer("non_follower_view_count"),
    followerNonFollowerRatio: numeric("follower_non_follower_ratio", {
      precision: 12,
      scale: 4,
      mode: "number",
    }),
    reachCount: integer("reach_count"),
    hookRate: numeric("hook_rate", { precision: 7, scale: 3, mode: "number" }),
    averageWatchTimeMs: integer("average_watch_time_ms"),
    holdRate: numeric("hold_rate", { precision: 7, scale: 3, mode: "number" }),
    description: text("description"),
    // Derived metrics stored as generated columns so PostgREST can sort and
    // page over them. Formulas mirror `src/lib/ig/metrics.ts` (getIgPostMetrics):
    // a metric is NULL whenever the JS helper returns null, and rate weights
    // match IG_SAVE_WEIGHT / IG_SHARE_WEIGHT / IG_COMMENT_WEIGHT / IG_LIKE_WEIGHT.
    descriptionLength: integer("description_length").generatedAlwaysAs(
      sql`char_length(description)`,
    ),
    engagementRate: doublePrecision("engagement_rate").generatedAlwaysAs(
      sql`CASE
        WHEN view_count > 0
          AND (like_count IS NOT NULL OR comment_count IS NOT NULL OR save_count IS NOT NULL OR share_count IS NOT NULL)
        THEN (COALESCE(like_count, 0) + COALESCE(comment_count, 0) + COALESCE(save_count, 0) + COALESCE(share_count, 0))::double precision * 100 / view_count
      END`,
    ),
    weightedEngagementRate: doublePrecision(
      "weighted_engagement_rate",
    ).generatedAlwaysAs(
      sql`CASE
        WHEN view_count > 0
          AND (like_count IS NOT NULL OR comment_count IS NOT NULL OR save_count IS NOT NULL OR share_count IS NOT NULL)
        THEN (COALESCE(save_count, 0) * 4 + COALESCE(share_count, 0) * 3 + COALESCE(comment_count, 0) * 2 + COALESCE(like_count, 0))::double precision * 100 / view_count
      END`,
    ),
    saveRate: doublePrecision("save_rate").generatedAlwaysAs(
      sql`CASE WHEN view_count > 0 AND save_count IS NOT NULL THEN save_count::double precision * 100 / view_count END`,
    ),
    shareRate: doublePrecision("share_rate").generatedAlwaysAs(
      sql`CASE WHEN view_count > 0 AND share_count IS NOT NULL THEN share_count::double precision * 100 / view_count END`,
    ),
    commentRate: doublePrecision("comment_rate").generatedAlwaysAs(
      sql`CASE WHEN view_count > 0 AND comment_count IS NOT NULL THEN comment_count::double precision * 100 / view_count END`,
    ),
    likeRate: doublePrecision("like_rate").generatedAlwaysAs(
      sql`CASE WHEN view_count > 0 AND like_count IS NOT NULL THEN like_count::double precision * 100 / view_count END`,
    ),
    followsPer1kViews: doublePrecision("follows_per_1k_views").generatedAlwaysAs(
      sql`CASE WHEN view_count > 0 AND follows_count IS NOT NULL THEN follows_count::double precision * 1000 / view_count END`,
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ig_posts_ig_profile_id_idx").on(table.igProfileId),
    index("ig_posts_source_scrape_id_idx").on(table.sourceScrapeId),
    index("ig_posts_details_scrape_id_idx").on(table.detailsScrapeId),
    index("ig_posts_uploaded_at_idx").on(table.uploadedAt.desc()),
    unique("ig_posts_meta_media_id_key").on(table.metaMediaId),
    unique("ig_posts_ig_profile_id_post_url_key").on(
      table.igProfileId,
      table.postUrl,
    ),
    foreignKey({
      columns: [table.igProfileId],
      foreignColumns: [igProfiles.id],
      name: "ig_posts_ig_profile_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceScrapeId],
      foreignColumns: [scheduledScrapes.id],
      name: "ig_posts_source_scrape_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.detailsScrapeId],
      foreignColumns: [scheduledScrapes.id],
      name: "ig_posts_details_scrape_id_fkey",
    }).onDelete("set null"),
    check(
      "ig_posts_post_url_length",
      sql`char_length(trim(post_url)) >= 1 AND char_length(post_url) <= 2048`,
    ),
    check(
      "ig_posts_video_length_secs_non_negative",
      sql`video_length_secs IS NULL OR video_length_secs >= 0`,
    ),
    check(
      "ig_posts_view_count_non_negative",
      sql`view_count IS NULL OR view_count >= 0`,
    ),
    check(
      "ig_posts_save_count_non_negative",
      sql`save_count IS NULL OR save_count >= 0`,
    ),
    check(
      "ig_posts_share_count_non_negative",
      sql`share_count IS NULL OR share_count >= 0`,
    ),
    check(
      "ig_posts_comment_count_non_negative",
      sql`comment_count IS NULL OR comment_count >= 0`,
    ),
    check(
      "ig_posts_like_count_non_negative",
      sql`like_count IS NULL OR like_count >= 0`,
    ),
    check(
      "ig_posts_follows_count_non_negative",
      sql`follows_count IS NULL OR follows_count >= 0`,
    ),
    check(
      "ig_posts_follower_view_count_non_negative",
      sql`follower_view_count IS NULL OR follower_view_count >= 0`,
    ),
    check(
      "ig_posts_non_follower_view_count_non_negative",
      sql`non_follower_view_count IS NULL OR non_follower_view_count >= 0`,
    ),
    check(
      "ig_posts_reach_count_non_negative",
      sql`reach_count IS NULL OR reach_count >= 0`,
    ),
    check(
      "ig_posts_average_watch_time_ms_non_negative",
      sql`average_watch_time_ms IS NULL OR average_watch_time_ms >= 0`,
    ),
    check(
      "ig_posts_rates_non_negative",
      sql`(follower_non_follower_ratio IS NULL OR follower_non_follower_ratio >= 0)
        AND (hook_rate IS NULL OR hook_rate >= 0)
        AND (hold_rate IS NULL OR hold_rate >= 0)`,
    ),
    pgPolicy("Authenticated users can view ig posts", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert ig posts for their scrapes", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
    }),
    pgPolicy("Authenticated users can update ig posts for their scrapes", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        INNER JOIN public.groups ON groups.id = scheduled_scrapes.group_id
        WHERE scheduled_scrapes.id = source_scrape_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
    }),
  ],
).enableRLS();
