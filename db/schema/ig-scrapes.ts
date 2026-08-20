// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
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

export const igScrapes = pgTable(
  "ig_scrapes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    startedBy: uuid("started_by").notNull(),
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
    igUsername: text("ig_username").notNull(),
    profilePictureUrl: text("profile_picture_url"),
    igName: text("ig_name"),
    description: text("description"),
    note: text("note"),
    postCount: integer("post_count"),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ig_scrapes_created_at_idx").on(table.createdAt.desc()),
    index("ig_scrapes_started_by_idx").on(table.startedBy),
    unique("ig_scrapes_apify_run_id_key").on(table.apifyRunId),
    foreignKey({
      columns: [table.startedBy],
      foreignColumns: [authUsers.id],
      name: "ig_scrapes_started_by_fkey",
    }).onDelete("cascade"),
    check(
      "ig_scrapes_ig_username_format",
      sql`ig_username = lower(ig_username) AND ig_username ~ '^[a-z0-9._]{1,30}$'`,
    ),
    check(
      "ig_scrapes_post_count_non_negative",
      sql`post_count IS NULL OR post_count >= 0`,
    ),
    pgPolicy("Authenticated users can view ig scrapes", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert their own ig scrapes", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid() AS uid) = started_by)`,
    }),
    pgPolicy("Authenticated users can update ig scrapes", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
