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

import { authUsers } from "drizzle-orm/supabase";

import { igProfiles } from "./ig-profiles";

export const scheduledScrapeType = pgEnum("scheduled_scrape_type", [
  "posts",
  "reels",
  "post_details",
]);

export const scheduledScrapes = pgTable(
  "scheduled_scrapes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    igProfileId: uuid("ig_profile_id").notNull(),
    startedBy: uuid("started_by").notNull(),
    groupId: uuid("group_id").notNull(),
    scrapeType: scheduledScrapeType("scrape_type").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    apifyCalledAt: timestamp("apify_called_at", {
      withTimezone: true,
      mode: "string",
    }),
    apifyRunId: text("apify_run_id"),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    errorMessage: text("error_message"),
    requestedPostCount: integer("requested_post_count"),
    sinceWhen: timestamp("since_when", {
      withTimezone: true,
      mode: "string",
    }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scheduled_scrapes_created_at_idx").on(table.createdAt.desc()),
    index("scheduled_scrapes_group_id_idx").on(table.groupId),
    index("scheduled_scrapes_ig_profile_id_idx").on(table.igProfileId),
    index("scheduled_scrapes_started_by_idx").on(table.startedBy),
    unique("scheduled_scrapes_apify_run_id_key").on(table.apifyRunId),
    foreignKey({
      columns: [table.igProfileId],
      foreignColumns: [igProfiles.id],
      name: "scheduled_scrapes_ig_profile_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.startedBy],
      foreignColumns: [authUsers.id],
      name: "scheduled_scrapes_started_by_fkey",
    }).onDelete("cascade"),
    check(
      "scheduled_scrapes_requested_post_count_non_negative",
      sql`requested_post_count IS NULL OR requested_post_count >= 0`,
    ),
    pgPolicy("Authenticated users can view scheduled scrapes", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert their own scheduled scrapes", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid() AS uid) = started_by)`,
    }),
    pgPolicy("Authenticated users can update their own scheduled scrapes", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(( SELECT auth.uid() AS uid) = started_by)`,
      withCheck: sql`(( SELECT auth.uid() AS uid) = started_by)`,
    }),
  ],
).enableRLS();
