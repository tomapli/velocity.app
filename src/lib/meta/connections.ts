import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  discoverMetaInstagramAccounts,
  getMetaIdentity,
  isDefinitiveInvalidMetaToken,
  isMetaProviderConfigured,
  refreshInstagramAccessToken,
  type DiscoveredMetaInstagramAccount,
  type MetaAccessToken,
} from "@/lib/meta/api";
import { META_TOKEN_REFRESH_THRESHOLD_MS } from "@/lib/meta/constants";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta/crypto";
import type {
  MetaConnectionLookup,
  MetaConnectionSummary,
  MetaInstagramAccountSummary,
  MetaOauthProvider,
} from "@/lib/meta/types";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

type AdminClient = SupabaseClient<Database>;
type MetaConnection = Tables<"meta_connections">;
type MetaInstagramAccount = Tables<"meta_instagram_accounts">;

export interface ResolvedMetaAccountAccess {
  account: MetaInstagramAccount;
  connection: MetaConnection;
  token: string;
}

/** Stores a reusable workspace connection and every IG account discovered for it. */
export async function saveMetaConnection(params: {
  admin: AdminClient;
  provider: MetaOauthProvider;
  access: MetaAccessToken;
  createdBy: string;
}): Promise<{ connection: MetaConnection; accounts: MetaInstagramAccount[] }> {
  const identity = await getMetaIdentity(params.provider, params.access.token);
  const accounts = await discoverMetaInstagramAccounts(
    params.provider,
    params.access.token,
  );
  const now = new Date().toISOString();
  const { data: connection, error: connectionError } = await params.admin
    .from("meta_connections")
    .upsert(
      {
        provider: params.provider,
        external_user_id: identity.externalUserId,
        display_name: identity.displayName,
        account_picture_url: identity.accountPictureUrl,
        access_token_ciphertext: encryptMetaToken(params.access.token),
        token_expires_at: params.access.expiresAt,
        last_validated_at: now,
        last_used_at: now,
        created_by: params.createdBy,
        updated_at: now,
      },
      { onConflict: "provider,external_user_id" },
    )
    .select("*")
    .single();
  if (connectionError) {
    throw connectionError;
  }

  const storedAccounts = await replaceDiscoveredAccounts(
    params.admin,
    connection.id,
    accounts,
    now,
  );
  return { connection, accounts: storedAccounts };
}

/** Validates all reusable logins, refreshes supported tokens, and removes revoked ones. */
export async function listValidatedMetaConnections(
  admin: AdminClient,
  username?: string,
): Promise<MetaConnectionLookup> {
  const configured =
    isMetaProviderConfigured("facebook") ||
    isMetaProviderConfigured("instagram");
  if (!configured) {
    return { configured: false, connections: [], match: null };
  }

  const { data: rows, error } = await admin
    .from("meta_connections")
    .select("*")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }

  const validated = await Promise.all(
    (rows ?? []).map(async (connection) => {
      try {
        return await validateConnection(admin, connection);
      } catch {
        // A transient Meta/network failure must not delete or hide a reusable login.
        return connection;
      }
    }),
  );
  const active = validated.filter(
    (connection): connection is MetaConnection => connection !== null,
  );
  const connectionIds = active.map((connection) => connection.id);
  const accounts = await listAccounts(admin, connectionIds);
  const accountsByConnection = new Map<string, MetaInstagramAccount[]>();
  for (const account of accounts) {
    const current = accountsByConnection.get(account.connection_id) ?? [];
    current.push(account);
    accountsByConnection.set(account.connection_id, current);
  }

  const summaries = active.map((connection) =>
    toConnectionSummary(
      connection,
      accountsByConnection.get(connection.id) ?? [],
    ),
  );
  const normalizedUsername = username?.toLowerCase();
  const match = normalizedUsername
    ? findMostRecentMatch(summaries, normalizedUsername)
    : null;

  return { configured: true, connections: summaries, match };
}

export async function resolveMetaAccountAccess(
  admin: AdminClient,
  accountId: string,
  expectedUsername: string,
): Promise<ResolvedMetaAccountAccess> {
  const { data: account, error: accountError } = await admin
    .from("meta_instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (accountError) {
    throw accountError;
  }
  if (account.username.toLowerCase() !== expectedUsername.toLowerCase()) {
    throw new Error(
      `The selected Meta login grants access to @${account.username}, not @${expectedUsername}.`,
    );
  }

  const { data: connection, error: connectionError } = await admin
    .from("meta_connections")
    .select("*")
    .eq("id", account.connection_id)
    .single();
  if (connectionError) {
    throw connectionError;
  }

  const validated = await validateConnection(admin, connection);
  if (!validated) {
    throw new Error("This Meta login expired or was revoked. Reconnect it to continue.");
  }

  const token = account.access_token_ciphertext
    ? decryptMetaToken(account.access_token_ciphertext)
    : decryptMetaToken(validated.access_token_ciphertext);
  await admin
    .from("meta_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", validated.id);

  return { account, connection: validated, token };
}

/** Loads the already-validated credentials used by resumable queue workers. */
export async function loadStoredMetaAccountAccess(
  admin: AdminClient,
  accountId: string,
): Promise<ResolvedMetaAccountAccess> {
  const { data: account, error: accountError } = await admin
    .from("meta_instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (accountError) {
    throw accountError;
  }

  const { data: connection, error: connectionError } = await admin
    .from("meta_connections")
    .select("*")
    .eq("id", account.connection_id)
    .single();
  if (connectionError) {
    throw connectionError;
  }

  const ciphertext =
    account.access_token_ciphertext ?? connection.access_token_ciphertext;
  return {
    account,
    connection,
    token: decryptMetaToken(ciphertext),
  };
}

export async function deleteMetaConnection(
  admin: AdminClient,
  connectionId: string,
): Promise<void> {
  const { error } = await admin
    .from("meta_connections")
    .delete()
    .eq("id", connectionId);
  if (error) {
    throw error;
  }
}

async function validateConnection(
  admin: AdminClient,
  connection: MetaConnection,
): Promise<MetaConnection | null> {
  try {
    let token = decryptMetaToken(connection.access_token_ciphertext);
    let expiresAt = connection.token_expires_at;
    if (
      connection.provider === "instagram" &&
      shouldRefreshToken(connection.token_expires_at)
    ) {
      const refreshed = await refreshInstagramAccessToken(token);
      token = refreshed.token;
      expiresAt = refreshed.expiresAt;
    }

    const identity = await getMetaIdentity(connection.provider, token);
    const discovered = await discoverMetaInstagramAccounts(connection.provider, token);
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("meta_connections")
      .update({
        display_name: identity.displayName,
        account_picture_url: identity.accountPictureUrl,
        access_token_ciphertext: encryptMetaToken(token),
        token_expires_at: expiresAt,
        last_validated_at: now,
        updated_at: now,
      })
      .eq("id", connection.id)
      .select("*")
      .single();
    if (updateError) {
      throw updateError;
    }
    await replaceDiscoveredAccounts(admin, updated.id, discovered, now);
    return updated;
  } catch (error) {
    if (!isDefinitiveInvalidMetaToken(error)) {
      throw error;
    }
    await deleteMetaConnection(admin, connection.id);
    return null;
  }
}

async function replaceDiscoveredAccounts(
  admin: AdminClient,
  connectionId: string,
  accounts: DiscoveredMetaInstagramAccount[],
  now: string,
): Promise<MetaInstagramAccount[]> {
  if (accounts.length === 0) {
    const { error } = await admin
      .from("meta_instagram_accounts")
      .delete()
      .eq("connection_id", connectionId);
    if (error) {
      throw error;
    }
    return [];
  }
  const { data, error } = await admin
    .from("meta_instagram_accounts")
    .upsert(accounts.map((account) => toAccountInsert(connectionId, account, now)), {
      onConflict: "connection_id,ig_user_id",
    })
    .select("*");
  if (error) {
    throw error;
  }

  const discoveredIds = new Set(accounts.map((account) => account.igUserId));
  const { data: current, error: currentError } = await admin
    .from("meta_instagram_accounts")
    .select("id,ig_user_id")
    .eq("connection_id", connectionId);
  if (currentError) {
    throw currentError;
  }
  const staleIds = (current ?? [])
    .filter((account) => !discoveredIds.has(account.ig_user_id))
    .map((account) => account.id);
  if (staleIds.length > 0) {
    const { error: staleError } = await admin
      .from("meta_instagram_accounts")
      .delete()
      .in("id", staleIds);
    if (staleError) {
      throw staleError;
    }
  }
  return data ?? [];
}

async function listAccounts(
  admin: AdminClient,
  connectionIds: string[],
): Promise<MetaInstagramAccount[]> {
  if (connectionIds.length === 0) {
    return [];
  }
  const { data, error } = await admin
    .from("meta_instagram_accounts")
    .select("*")
    .in("connection_id", connectionIds)
    .order("username");
  if (error) {
    throw error;
  }
  return data ?? [];
}

function toAccountInsert(
  connectionId: string,
  account: DiscoveredMetaInstagramAccount,
  now: string,
) {
  return {
    connection_id: connectionId,
    ig_user_id: account.igUserId,
    username: account.username,
    name: account.name,
    profile_picture_url: account.profilePictureUrl,
    page_id: account.pageId,
    access_token_ciphertext: account.accessToken
      ? encryptMetaToken(account.accessToken)
      : null,
    discovered_at: now,
    updated_at: now,
  };
}

function toConnectionSummary(
  connection: MetaConnection,
  accounts: MetaInstagramAccount[],
): MetaConnectionSummary {
  return {
    id: connection.id,
    provider: connection.provider,
    displayName: connection.display_name,
    accountPictureUrl: connection.account_picture_url,
    lastUsedAt: connection.last_used_at,
    lastValidatedAt: connection.last_validated_at,
    tokenExpiresAt: connection.token_expires_at,
    accounts: accounts.map(toAccountSummary),
  };
}

function toAccountSummary(account: MetaInstagramAccount): MetaInstagramAccountSummary {
  return {
    id: account.id,
    connectionId: account.connection_id,
    igUserId: account.ig_user_id,
    username: account.username,
    name: account.name,
    profilePictureUrl: account.profile_picture_url,
  };
}

function findMostRecentMatch(
  connections: MetaConnectionSummary[],
  username: string,
): MetaConnectionLookup["match"] {
  for (const connection of connections) {
    const account = connection.accounts.find(
      (candidate) => candidate.username.toLowerCase() === username,
    );
    if (account) {
      return { connection, account };
    }
  }
  return null;
}

function shouldRefreshToken(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiresTimestamp = Date.parse(expiresAt);
  return (
    Number.isFinite(expiresTimestamp) &&
    expiresTimestamp - Date.now() <= META_TOKEN_REFRESH_THRESHOLD_MS
  );
}
