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

export const igProfiles = pgTable(
  "ig_profiles",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
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
    unique("ig_profiles_ig_username_key").on(table.igUsername),
    index("ig_profiles_created_at_idx").on(table.createdAt.desc()),
    index("ig_profiles_created_by_idx").on(table.createdBy),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "ig_profiles_created_by_fkey",
    }).onDelete("cascade"),
    check(
      "ig_profiles_ig_username_format",
      sql`ig_username = lower(ig_username) AND ig_username ~ '^[a-z0-9._]{1,30}$'`,
    ),
    check(
      "ig_profiles_post_count_non_negative",
      sql`post_count IS NULL OR post_count >= 0`,
    ),
    pgPolicy("Authenticated users can view ig profiles", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert ig profiles", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid() AS uid) = created_by)`,
    }),
    pgPolicy("Authenticated users can update ig profiles", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
