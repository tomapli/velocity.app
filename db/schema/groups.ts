// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  pgEnum,
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
import { metaConnections } from "./meta-connections";
import { metaInstagramAccounts } from "./meta-instagram-accounts";

export const igScrapeDataSource = pgEnum("ig_scrape_data_source", [
  "public",
  "meta_hybrid",
]);

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
    dataSource: igScrapeDataSource("data_source").default("public").notNull(),
    metaConnectionId: uuid("meta_connection_id"),
    metaInstagramAccountId: uuid("meta_instagram_account_id"),
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
    index("groups_meta_connection_id_idx").on(table.metaConnectionId),
    foreignKey({
      columns: [table.igProfileId],
      foreignColumns: [igProfiles.id],
      name: "groups_ig_profile_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metaConnectionId],
      foreignColumns: [metaConnections.id],
      name: "groups_meta_connection_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.metaInstagramAccountId],
      foreignColumns: [metaInstagramAccounts.id],
      name: "groups_meta_instagram_account_id_fkey",
    }).onDelete("set null"),
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
