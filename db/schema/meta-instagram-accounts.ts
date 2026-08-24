// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  foreignKey,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { metaConnections } from "./meta-connections";

/** Instagram professional accounts discovered through each reusable Meta login. */
export const metaInstagramAccounts = pgTable(
  "meta_instagram_accounts",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    connectionId: uuid("connection_id").notNull(),
    igUserId: text("ig_user_id").notNull(),
    username: text("username").notNull(),
    name: text("name"),
    profilePictureUrl: text("profile_picture_url"),
    pageId: text("page_id"),
    accessTokenCiphertext: text("access_token_ciphertext"),
    discoveredAt: timestamp("discovered_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("meta_instagram_accounts_connection_user_key").on(
      table.connectionId,
      table.igUserId,
    ),
    index("meta_instagram_accounts_username_idx").on(table.username),
    index("meta_instagram_accounts_connection_id_idx").on(table.connectionId),
    foreignKey({
      columns: [table.connectionId],
      foreignColumns: [metaConnections.id],
      name: "meta_instagram_accounts_connection_id_fkey",
    }).onDelete("cascade"),
  ],
).enableRLS();

