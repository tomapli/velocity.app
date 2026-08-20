// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  foreignKey,
  uuid,
  text,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { authUsers } from "drizzle-orm/supabase";

export const authorizedUsers = pgTable(
  "authorized_users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("authorized_users_email_key").on(table.email),
    unique("authorized_users_user_id_key").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "authorized_users_user_id_fkey",
    }).onDelete("set null"),
    check(
      "authorized_users_email_format",
      sql`char_length(trim(email)) >= 3 AND email = lower(email) AND email LIKE '%_@_%.%'`,
    ),
  ],
).enableRLS();
