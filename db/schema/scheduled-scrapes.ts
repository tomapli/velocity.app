// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  pgEnum,
  foreignKey,
  pgPolicy,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { groups } from "./groups";

export const scheduledScrapeType = pgEnum("scheduled_scrape_type", [
  "posts",
  "reels",
  "post_details",
]);

export const scheduledScrapes = pgTable(
  "scheduled_scrapes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
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
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scheduled_scrapes_group_id_idx").on(table.groupId),
    unique("scheduled_scrapes_apify_run_id_key").on(table.apifyRunId),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [groups.id],
      name: "scheduled_scrapes_group_id_fkey",
    }).onDelete("cascade"),
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
      withCheck: sql`EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
    }),
    pgPolicy("Authenticated users can update their own scheduled scrapes", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM public.groups
        WHERE groups.id = group_id
          AND groups.created_by = (SELECT auth.uid() AS uid)
      )`,
    }),
  ],
).enableRLS();
