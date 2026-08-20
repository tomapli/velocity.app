// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  foreignKey,
  pgPolicy,
  uuid,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { authUsers } from "drizzle-orm/supabase";

export const items = pgTable(
  "items",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("items_created_at_idx").on(table.createdAt.desc()),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "items_created_by_fkey",
    }).onDelete("cascade"),
    check(
      "items_title_length",
      sql`char_length(trim(title)) >= 1 AND char_length(title) <= 200`,
    ),
    pgPolicy("Authenticated users can view items", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    pgPolicy("Authenticated users can insert their own items", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(( SELECT auth.uid() AS uid) = created_by)`,
    }),
    pgPolicy("Authenticated users can delete items", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ],
).enableRLS();
