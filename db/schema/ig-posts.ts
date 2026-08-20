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
    description: text("description"),
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
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      )`,
    }),
    pgPolicy("Authenticated users can update ig posts for their scrapes", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM public.scheduled_scrapes
        WHERE scheduled_scrapes.id = source_scrape_id
          AND scheduled_scrapes.started_by = (SELECT auth.uid() AS uid)
      )`,
    }),
  ],
).enableRLS();
