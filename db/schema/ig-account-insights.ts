// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  foreignKey,
  pgPolicy,
  uuid,
  timestamp,
  jsonb,
  index,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { groups } from "./groups";
import { igProfiles } from "./ig-profiles";

/** Raw, version-tolerant Meta account-insight responses for a scrape. */
export const igAccountInsights = pgTable(
  "ig_account_insights",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    igProfileId: uuid("ig_profile_id").notNull(),
    groupId: uuid("group_id").notNull(),
    // Window length of the snapshot; pre-range rows default to the old 90 days.
    periodDays: integer("period_days").default(90).notNull(),
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    periodEnd: timestamp("period_end", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    metrics: jsonb("metrics").notNull(),
    capturedAt: timestamp("captured_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("ig_account_insights_group_period_key").on(
      table.groupId,
      table.periodDays,
    ),
    index("ig_account_insights_profile_captured_idx").on(
      table.igProfileId,
      table.capturedAt.desc(),
    ),
    foreignKey({
      columns: [table.igProfileId],
      foreignColumns: [igProfiles.id],
      name: "ig_account_insights_profile_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [groups.id],
      name: "ig_account_insights_group_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("Authenticated users can view Instagram account insights", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ],
).enableRLS();

