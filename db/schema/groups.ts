// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  foreignKey,
  pgPolicy,
  uuid,
  timestamp,
  integer,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { authUsers } from "drizzle-orm/supabase";

import { igProfiles } from "./ig-profiles";

export const groups = pgTable(
  "groups",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    igProfileId: uuid("ig_profile_id").notNull(),
    createdBy: uuid("created_by").notNull(),
    requestedPostCount: integer("requested_post_count"),
    sinceWhen: timestamp("since_when", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("groups_created_at_idx").on(table.createdAt.desc()),
    index("groups_ig_profile_id_idx").on(table.igProfileId),
    index("groups_created_by_idx").on(table.createdBy),
    foreignKey({
      columns: [table.igProfileId],
      foreignColumns: [igProfiles.id],
      name: "groups_ig_profile_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "groups_created_by_fkey",
    }).onDelete("cascade"),
    check(
      "groups_requested_post_count_non_negative",
      sql`requested_post_count IS NULL OR requested_post_count >= 0`,
    ),
    pgPolicy("Authenticated users can view groups", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert their own groups", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid() AS uid) = created_by)`,
    }),
  ],
).enableRLS();
