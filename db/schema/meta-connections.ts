// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { authUsers } from "drizzle-orm/supabase";
import { foreignKey } from "drizzle-orm/pg-core";

export const metaOauthProvider = pgEnum("meta_oauth_provider", [
  "facebook",
  "instagram",
]);

/**
 * Workspace-wide Meta logins. Tokens are application-encrypted and this table
 * intentionally has no browser-facing RLS policies.
 */
export const metaConnections = pgTable(
  "meta_connections",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    provider: metaOauthProvider("provider").notNull(),
    externalUserId: text("external_user_id").notNull(),
    displayName: text("display_name").notNull(),
    accountPictureUrl: text("account_picture_url"),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastValidatedAt: timestamp("last_validated_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", {
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
    unique("meta_connections_provider_external_user_key").on(
      table.provider,
      table.externalUserId,
    ),
    index("meta_connections_last_used_at_idx").on(table.lastUsedAt.desc()),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "meta_connections_created_by_fkey",
    }).onDelete("set null"),
  ],
).enableRLS();
