import "server-only";

import { z } from "zod";

import {
  META_FACEBOOK_SCOPES,
  META_INSTAGRAM_SCOPES,
  META_MEDIA_PAGE_SIZE,
} from "@/lib/meta/constants";
import { getGrantedFacebookPageIds } from "@/lib/meta/facebook-token";
import { getMetaInstagramProfileFields } from "@/lib/meta/fields";
import type { MetaOauthProvider } from "@/lib/meta/types";

const MetaErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    message: z.string().optional(),
    type: z.string().optional(),
  }),
});

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
  token_type: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
});

const FacebookIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  picture: z
    .object({ data: z.object({ url: z.string().url().optional() }) })
    .optional(),
});

const InstagramIdentitySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  username: z.string(),
  name: z.string().nullable().optional(),
  profile_picture_url: z.string().url().nullable().optional(),
  followers_count: z.number().int().nonnegative().nullable().optional(),
  media_count: z.number().int().nonnegative().nullable().optional(),
});

const FacebookPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string().min(1),
  tasks: z.array(z.string()).optional(),
  instagram_business_account: z
    .object({
      id: z.string(),
      username: z.string().optional(),
      name: z.string().nullable().optional(),
      profile_picture_url: z.string().url().nullable().optional(),
    })
    .optional(),
});

const FacebookPagesSchema = z.object({ data: z.array(FacebookPageSchema) });

const MetaPagingSchema = z.object({
  next: z.string().url().optional(),
  cursors: z
    .object({
      after: z.string().optional(),
    })
    .optional(),
});

const MetaMediaSchema = z.object({
  id: z.string(),
  caption: z.string().nullable().optional(),
  comments_count: z.number().int().nonnegative().nullable().optional(),
  children: z
    .object({
      data: z.array(
        z.object({
          id: z.string().optional(),
          media_type: z.string().optional(),
          media_url: z.string().url().nullable().optional(),
          thumbnail_url: z.string().url().nullable().optional(),
        }),
      ),
    })
    .optional(),
  like_count: z.number().int().nonnegative().nullable().optional(),
  media_product_type: z.string().nullable().optional(),
  media_type: z.string(),
  media_url: z.string().url().nullable().optional(),
  permalink: z.string().url(),
  thumbnail_url: z.string().url().nullable().optional(),
  timestamp: z.string(),
});

const MetaMediaPageSchema = z.object({
  data: z.array(MetaMediaSchema),
  paging: MetaPagingSchema.optional(),
});

const InsightValueSchema = z.object({
  end_time: z.string().optional(),
  value: z.unknown(),
});

const InsightSchema = z.object({
  name: z.string(),
  period: z.string().optional(),
  values: z.array(InsightValueSchema).optional(),
  total_value: z
    .object({
      value: z.unknown(),
      breakdowns: z.unknown().optional(),
    })
    .optional(),
});

const InsightsResponseSchema = z.object({ data: z.array(InsightSchema) });

export type MetaMedia = z.infer<typeof MetaMediaSchema>;
export type MetaInsight = z.infer<typeof InsightSchema>;

export interface MetaAccessToken {
  token: string;
  expiresAt: string | null;
}

export interface MetaIdentity {
  externalUserId: string;
  displayName: string;
  accountPictureUrl: string | null;
}

export interface MetaInstagramProfile {
  followerCount: number | null;
  mediaCount: number | null;
  name: string | null;
  profilePictureUrl: string | null;
  username: string;
}

export interface MetaMediaPage {
  items: MetaMedia[];
  nextCursor: string | null;
}

export interface DiscoveredMetaInstagramAccount {
  igUserId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  pageId: string | null;
  accessToken: string | null;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly errorType: string | null,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export function isDefinitiveInvalidMetaToken(error: unknown): boolean {
  return (
    error instanceof MetaApiError &&
    (error.code === 190 || error.errorType === "OAuthException")
  );
}

export function getMetaGraphApiVersion(): string {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  if (!version || !/^v\d+\.\d+$/.test(version)) {
    throw new Error("META_GRAPH_API_VERSION must look like v25.0");
  }
  return version;
}

export function isMetaProviderConfigured(provider: MetaOauthProvider): boolean {
  const appId =
    provider === "facebook"
      ? process.env.META_FACEBOOK_APP_ID
      : process.env.META_INSTAGRAM_APP_ID;
  const appSecret =
    provider === "facebook"
      ? process.env.META_FACEBOOK_APP_SECRET
      : process.env.META_INSTAGRAM_APP_SECRET;

  return Boolean(
    appId &&
      appSecret &&
      process.env.META_GRAPH_API_VERSION &&
      process.env.META_TOKEN_ENCRYPTION_KEY,
  );
}

export function buildMetaAuthorizationUrl(
  provider: MetaOauthProvider,
  redirectUri: string,
  state: string,
): string {
  const appId = getMetaAppId(provider);
  const scopes =
    provider === "facebook" ? META_FACEBOOK_SCOPES : META_INSTAGRAM_SCOPES;
  const baseUrl =
    provider === "facebook"
      ? `https://www.facebook.com/${getMetaGraphApiVersion()}/dialog/oauth`
      : "https://www.instagram.com/oauth/authorize";
  const url = new URL(baseUrl);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("state", state);
  if (provider === "instagram") {
    url.searchParams.set("enable_fb_login", "0");
    url.searchParams.set("force_authentication", "1");
  }
  return url.toString();
}

export async function exchangeMetaOauthCode(
  provider: MetaOauthProvider,
  code: string,
  redirectUri: string,
): Promise<MetaAccessToken> {
  return provider === "facebook"
    ? exchangeFacebookCode(code, redirectUri)
    : exchangeInstagramCode(code, redirectUri);
}

export async function getMetaIdentity(
  provider: MetaOauthProvider,
  token: string,
): Promise<MetaIdentity> {
  if (provider === "facebook") {
    const raw = await fetchMetaJson(
      buildGraphUrl("facebook", "me", {
        fields: "id,name,picture",
      }),
      token,
    );
    const identity = FacebookIdentitySchema.parse(raw);
    return {
      externalUserId: identity.id,
      displayName: identity.name,
      accountPictureUrl: identity.picture?.data.url ?? null,
    };
  }

  const raw = await fetchMetaJson(
    buildGraphUrl("instagram", "me", {
      fields: "id,user_id,username,name,profile_picture_url",
    }),
    token,
  );
  const identity = InstagramIdentitySchema.parse(raw);
  const externalUserId = identity.user_id ?? identity.id;
  if (externalUserId == null) {
    throw new Error("Meta did not return an Instagram user ID");
  }
  return {
    externalUserId: String(externalUserId),
    displayName: identity.name ?? identity.username,
    accountPictureUrl: identity.profile_picture_url ?? null,
  };
}

export async function discoverMetaInstagramAccounts(
  provider: MetaOauthProvider,
  token: string,
): Promise<DiscoveredMetaInstagramAccount[]> {
  if (provider === "instagram") {
    const raw = await fetchMetaJson(
      buildGraphUrl("instagram", "me", {
        fields: "id,user_id,username,name,profile_picture_url",
      }),
      token,
    );
    const account = InstagramIdentitySchema.parse(raw);
    const igUserId = account.user_id ?? account.id;
    if (igUserId == null) {
      return [];
    }
    return [
      {
        igUserId: String(igUserId),
        username: account.username.toLowerCase(),
        name: account.name ?? null,
        profilePictureUrl: account.profile_picture_url ?? null,
        pageId: null,
        accessToken: null,
      },
    ];
  }

  const pages = await discoverFacebookPages(token);

  return pages.flatMap((page) => {
    const account = page.instagram_business_account;
    if (!account?.username) {
      return [];
    }
    return [
      {
        igUserId: account.id,
        username: account.username.toLowerCase(),
        name: account.name ?? page.name,
        profilePictureUrl: account.profile_picture_url ?? null,
        pageId: page.id,
        accessToken: page.access_token,
      },
    ];
  });
}

async function discoverFacebookPages(
  token: string,
): Promise<Array<z.infer<typeof FacebookPageSchema>>> {
  const raw = await fetchMetaJson(
    buildGraphUrl("facebook", "me/accounts", {
      fields:
        "id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}",
      limit: String(META_MEDIA_PAGE_SIZE),
    }),
    token,
  );
  const managedPages = FacebookPagesSchema.parse(raw).data;
  const managedPageIds = new Set(managedPages.map((page) => page.id));

  let grantedPageIds: string[];
  try {
    grantedPageIds = await getGrantedPageIdsFromToken(token);
  } catch (error) {
    if (managedPages.length === 0) {
      throw error;
    }
    return managedPages;
  }

  const missingPageIds = grantedPageIds.filter(
    (pageId) => !managedPageIds.has(pageId),
  );
  const settledPages = await Promise.allSettled(
    missingPageIds.map(async (pageId) => {
      const page = await fetchMetaJson(
        buildGraphUrl("facebook", pageId, {
          fields:
            "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
        }),
        token,
      );
      return FacebookPageSchema.parse(page);
    }),
  );
  const grantedPages = settledPages.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (
    managedPages.length === 0 &&
    missingPageIds.length > 0 &&
    grantedPages.length === 0
  ) {
    const failure = settledPages.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw failure?.reason instanceof Error
      ? failure.reason
      : new Error("Meta granted Page access, but its details could not be loaded.");
  }

  return [...managedPages, ...grantedPages];
}

async function getGrantedPageIdsFromToken(token: string): Promise<string[]> {
  const raw = await fetchMetaJson(
    buildGraphUrl("facebook", "debug_token", { input_token: token }),
    `${getMetaAppId("facebook")}|${getMetaAppSecret("facebook")}`,
  );
  return getGrantedFacebookPageIds(raw);
}

export async function getMetaInstagramProfile(params: {
  provider: MetaOauthProvider;
  igUserId: string;
  token: string;
}): Promise<MetaInstagramProfile> {
  const objectId = params.provider === "instagram" ? "me" : params.igUserId;
  const raw = await fetchMetaJson(
    buildGraphUrl(params.provider, objectId, {
      fields: getMetaInstagramProfileFields(params.provider),
    }),
    params.token,
  );
  const profile = InstagramIdentitySchema.parse(raw);
  return {
    followerCount: profile.followers_count ?? null,
    mediaCount: profile.media_count ?? null,
    name: profile.name ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
    username: profile.username,
  };
}

export async function refreshInstagramAccessToken(
  token: string,
): Promise<MetaAccessToken> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const response = TokenResponseSchema.parse(await fetchMetaJson(url));
  return toMetaAccessToken(response);
}

/** Loads one bounded media page and returns only the opaque continuation cursor. */
export async function listMetaMediaPage(params: {
  provider: MetaOauthProvider;
  igUserId: string;
  token: string;
  sinceWhen: string | null;
  cursor: string | null;
  limit: number;
}): Promise<MetaMediaPage> {
  const fields = [
    "id",
    "caption",
    "comments_count",
    "children{id,media_type,media_url,thumbnail_url}",
    "like_count",
    "media_product_type",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
  ].join(",");
  const path = params.provider === "instagram" ? "me/media" : `${params.igUserId}/media`;
  const query: Record<string, string> = {
    fields,
    limit: String(params.limit),
  };
  if (params.cursor) {
    query.after = params.cursor;
  }
  const url = buildGraphUrl(params.provider, path, query);
  const media: MetaMedia[] = [];
  const sinceTimestamp = params.sinceWhen ? Date.parse(params.sinceWhen) : null;

  const page = MetaMediaPageSchema.parse(await fetchMetaJson(url, params.token));
  for (const item of page.data) {
    const uploadedAt = Date.parse(item.timestamp);
    if (sinceTimestamp && Number.isFinite(uploadedAt) && uploadedAt < sinceTimestamp) {
      return { items: media, nextCursor: null };
    }
    media.push(item);
  }

  return {
    items: media,
    nextCursor: getMetaPagingCursor(page.paging),
  };
}

export async function getMetaInsights(params: {
  provider: MetaOauthProvider;
  objectId: string;
  token: string;
  metrics: readonly string[];
  query?: Readonly<Record<string, string>>;
}): Promise<MetaInsight[]> {
  const url = buildGraphUrl(
    params.provider,
    `${params.objectId}/insights`,
    {
      metric: params.metrics.join(","),
      ...params.query,
    },
  );
  const raw = await fetchMetaJson(url, params.token);
  return InsightsResponseSchema.parse(raw).data;
}

export function getMetaGraphHost(provider: MetaOauthProvider): string {
  return provider === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
}

async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<MetaAccessToken> {
  const shortUrl = new URL(
    `https://graph.facebook.com/${getMetaGraphApiVersion()}/oauth/access_token`,
  );
  shortUrl.searchParams.set("client_id", getMetaAppId("facebook"));
  shortUrl.searchParams.set("client_secret", getMetaAppSecret("facebook"));
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortToken = TokenResponseSchema.parse(await fetchMetaJson(shortUrl));

  const longUrl = new URL(
    `https://graph.facebook.com/${getMetaGraphApiVersion()}/oauth/access_token`,
  );
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", getMetaAppId("facebook"));
  longUrl.searchParams.set("client_secret", getMetaAppSecret("facebook"));
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
  const longToken = TokenResponseSchema.parse(await fetchMetaJson(longUrl));
  return toMetaAccessToken(longToken);
}

async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<MetaAccessToken> {
  const form = new URLSearchParams({
    client_id: getMetaAppId("instagram"),
    client_secret: getMetaAppSecret("instagram"),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toMetaApiError(raw, response.status);
  }
  const shortToken = TokenResponseSchema.parse(raw);

  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", getMetaAppSecret("instagram"));
  longUrl.searchParams.set("access_token", shortToken.access_token);
  const longToken = TokenResponseSchema.parse(await fetchMetaJson(longUrl));
  return toMetaAccessToken(longToken);
}

function buildGraphUrl(
  provider: MetaOauthProvider,
  path: string,
  query: Readonly<Record<string, string>>,
): URL {
  const url = new URL(
    `https://${getMetaGraphHost(provider)}/${getMetaGraphApiVersion()}/${path}`,
  );
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function fetchMetaJson(url: URL, accessToken?: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toMetaApiError(raw, response.status);
  }
  return raw;
}

function toBearerPaginationUrl(value: string): URL {
  const url = new URL(value);
  url.searchParams.delete("access_token");
  return url;
}

function getMetaPagingCursor(
  paging: z.infer<typeof MetaPagingSchema> | undefined,
): string | null {
  if (paging?.cursors?.after) {
    return paging.cursors.after;
  }
  if (!paging?.next) {
    return null;
  }
  return toBearerPaginationUrl(paging.next).searchParams.get("after");
}

function toMetaApiError(raw: unknown, status: number): MetaApiError {
  const parsed = MetaErrorSchema.safeParse(raw);
  if (!parsed.success) {
    return new MetaApiError(`Meta API request failed (${status})`, status, null, null, null);
  }
  const error = parsed.data.error;
  return new MetaApiError(
    error.message ?? `Meta API request failed (${status})`,
    status,
    error.code ?? null,
    error.error_subcode ?? null,
    error.type ?? null,
  );
}

function getMetaAppId(provider: MetaOauthProvider): string {
  const value =
    provider === "facebook"
      ? process.env.META_FACEBOOK_APP_ID
      : process.env.META_INSTAGRAM_APP_ID;
  if (!value) {
    throw new Error(`Meta ${provider} app ID is not configured`);
  }
  return value;
}

function getMetaAppSecret(provider: MetaOauthProvider): string {
  const value =
    provider === "facebook"
      ? process.env.META_FACEBOOK_APP_SECRET
      : process.env.META_INSTAGRAM_APP_SECRET;
  if (!value) {
    throw new Error(`Meta ${provider} app secret is not configured`);
  }
  return value;
}

function toMetaAccessToken(value: z.infer<typeof TokenResponseSchema>): MetaAccessToken {
  return {
    token: value.access_token,
    expiresAt: value.expires_in
      ? new Date(Date.now() + value.expires_in * 1_000).toISOString()
      : null,
  };
}
