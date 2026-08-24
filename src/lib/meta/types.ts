export const META_OAUTH_PROVIDERS = ["facebook", "instagram"] as const;

export type MetaOauthProvider = (typeof META_OAUTH_PROVIDERS)[number];

export interface MetaConnectionSummary {
  id: string;
  provider: MetaOauthProvider;
  displayName: string;
  accountPictureUrl: string | null;
  lastUsedAt: string | null;
  lastValidatedAt: string | null;
  tokenExpiresAt: string | null;
  accounts: MetaInstagramAccountSummary[];
}

export interface MetaInstagramAccountSummary {
  id: string;
  connectionId: string;
  igUserId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
}

export interface MetaConnectionLookup {
  configured: boolean;
  connections: MetaConnectionSummary[];
  match: {
    connection: MetaConnectionSummary;
    account: MetaInstagramAccountSummary;
  } | null;
}
