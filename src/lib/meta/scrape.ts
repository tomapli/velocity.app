import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCanonicalInstagramPostUrl } from "@/lib/apify/instagram-listing";
import {
  getMetaInsights,
  getMetaInstagramProfile,
  listMetaMedia,
  MetaApiError,
  type MetaInsight,
  type MetaMedia,
} from "@/lib/meta/api";
import {
  META_ACCOUNT_INSIGHT_METRICS,
  META_ACCOUNT_INSIGHTS_DAYS,
  META_FETCH_CONCURRENCY,
  META_MEDIA_INSIGHT_METRICS,
  META_REEL_INSIGHT_METRICS,
  type MetaAccountInsightMetric,
} from "@/lib/meta/constants";
import type { ResolvedMetaAccountAccess } from "@/lib/meta/connections";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Insertable, Tables } from "@/lib/supabase/tables";

const REELS_PRODUCT_TYPE = "REELS";
const MEDIA_TYPE_CAROUSEL = "CAROUSEL_ALBUM";
const MEDIA_TYPE_VIDEO = "VIDEO";
const PERCENT_MAX = 100;
const MILLISECONDS_PER_SECOND = 1_000;
const META_EXPECTED_INSIGHT_ERROR_STATUS = 400;

type AdminClient = SupabaseClient<Database>;
type ScheduledScrape = Tables<"scheduled_scrapes">;

export interface ImportMetaScrapeParams {
  admin: AdminClient;
  access: ResolvedMetaAccountAccess;
  groupId: string;
  profileId: string;
  requestedPostCount: number | null;
  sinceWhen: string | null;
  listingScrapes: ScheduledScrape[];
}

/** Imports private Meta media and the maximum available account-insight window. */
export async function importMetaScrape(params: ImportMetaScrapeParams): Promise<void> {
  const provider = params.access.connection.provider;
  const [media, metaProfile] = await Promise.all([
    listMetaMedia({
      provider,
      igUserId: params.access.account.ig_user_id,
      token: params.access.token,
      requestedPostCount: params.requestedPostCount,
      sinceWhen: params.sinceWhen,
    }),
    getMetaInstagramProfile({
      provider,
      igUserId: params.access.account.ig_user_id,
      token: params.access.token,
    }),
  ]);
  const mediaWithInsights = await mapWithConcurrency(
    media,
    META_FETCH_CONCURRENCY,
    async (item) => ({
      media: item,
      insights: await getMediaInsights(
        provider,
        params.access.token,
        item,
      ),
    }),
  );

  const listingByType = new Map(
    params.listingScrapes.map((scrape) => [scrape.scrape_type, scrape]),
  );
  const existing = await listExistingPosts(params.admin, params.profileId);
  const existingByMetaId = new Map(
    existing.flatMap((post) =>
      post.meta_media_id ? [[post.meta_media_id, post] as const] : [],
    ),
  );
  const existingByUrl = new Map(existing.map((post) => [post.post_url, post]));

  for (const item of mediaWithInsights) {
    const sourceType = isReel(item.media) ? "reels" : "posts";
    const sourceScrape = listingByType.get(sourceType);
    if (!sourceScrape) {
      throw new Error(`Missing ${sourceType} scrape row for Meta import`);
    }
    const mapped = mapMetaMedia(
      params.profileId,
      sourceScrape.id,
      item.media,
      item.insights,
    );
    const existingPost =
      existingByMetaId.get(item.media.id) ?? existingByUrl.get(mapped.post_url);

    const query = existingPost
      ? params.admin.from("ig_posts").update(mapped).eq("id", existingPost.id)
      : params.admin.from("ig_posts").insert(mapped);
    const { error } = await query;
    if (error) {
      throw error;
    }
  }

  const periodEnd = new Date();
  const periodStart = new Date(
    periodEnd.getTime() - META_ACCOUNT_INSIGHTS_DAYS * 24 * 60 * 60 * 1_000,
  );
  const accountMetrics = await getAccountInsights({
    provider,
    igUserId: params.access.account.ig_user_id,
    token: params.access.token,
    since: Math.floor(periodStart.getTime() / 1_000),
    until: Math.floor(periodEnd.getTime() / 1_000),
  });
  const { error: insightError } = await params.admin
    .from("ig_account_insights")
    .upsert(
      {
        ig_profile_id: params.profileId,
        group_id: params.groupId,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        metrics: accountMetrics,
        captured_at: periodEnd.toISOString(),
      },
      { onConflict: "group_id" },
    );
  if (insightError) {
    throw insightError;
  }

  const { error: profileError } = await params.admin
    .from("ig_profiles")
    .update({
      ig_name: metaProfile.name ?? params.access.account.name,
      profile_picture_url:
        metaProfile.profilePictureUrl ?? params.access.account.profile_picture_url,
      post_count: metaProfile.mediaCount,
      follower_count: metaProfile.followerCount,
      updated_at: periodEnd.toISOString(),
    })
    .eq("id", params.profileId);
  if (profileError) {
    throw profileError;
  }
}

async function getMediaInsights(
  provider: ResolvedMetaAccountAccess["connection"]["provider"],
  token: string,
  media: MetaMedia,
): Promise<MetaInsight[]> {
  const metrics = isReel(media)
    ? META_REEL_INSIGHT_METRICS
    : META_MEDIA_INSIGHT_METRICS;
  try {
    const bulk = await getMetaInsights({
      provider,
      objectId: media.id,
      token,
      metrics,
    });
    return [...bulk, ...(await getMediaFollowerBreakdown(provider, token, media.id))];
  } catch (error) {
    if (!isExpectedUnavailableInsight(error)) {
      throw error;
    }
  }

  const individually = await mapWithConcurrency(
    metrics,
    META_FETCH_CONCURRENCY,
    async (metric) => {
      try {
        return await getMetaInsights({
          provider,
          objectId: media.id,
          token,
          metrics: [metric],
        });
      } catch (error) {
        if (isExpectedUnavailableInsight(error)) {
          return [];
        }
        throw error;
      }
    },
  );
  return [
    ...individually.flat(),
    ...(await getMediaFollowerBreakdown(provider, token, media.id)),
  ];
}

async function getMediaFollowerBreakdown(
  provider: ResolvedMetaAccountAccess["connection"]["provider"],
  token: string,
  mediaId: string,
): Promise<MetaInsight[]> {
  try {
    return await getMetaInsights({
      provider,
      objectId: mediaId,
      token,
      metrics: ["views"],
      query: { metric_type: "total_value", breakdown: "follow_type" },
    });
  } catch (error) {
    if (isExpectedUnavailableInsight(error)) {
      return [];
    }
    throw error;
  }
}

async function getAccountInsights(params: {
  provider: ResolvedMetaAccountAccess["connection"]["provider"];
  igUserId: string;
  token: string;
  since: number;
  until: number;
}): Promise<Json> {
  const entries = await mapWithConcurrency(
    META_ACCOUNT_INSIGHT_METRICS,
    META_FETCH_CONCURRENCY,
    async (metric) => [metric, await getAccountInsightMetric(params, metric)] as const,
  );
  return Object.fromEntries(entries);
}

async function getAccountInsightMetric(
  params: {
    provider: ResolvedMetaAccountAccess["connection"]["provider"];
    igUserId: string;
    token: string;
    since: number;
    until: number;
  },
  metric: MetaAccountInsightMetric,
): Promise<Json> {
  if (metric.endsWith("_demographics")) {
    const breakdowns = ["age", "gender", "city", "country"] as const;
    const entries = await Promise.all(
      breakdowns.map(async (breakdown) => {
        try {
          const insights = await getMetaInsights({
            provider: params.provider,
            objectId: params.igUserId,
            token: params.token,
            metrics: [metric],
            query: {
              period: "lifetime",
              metric_type: "total_value",
              timeframe: "last_90_days",
              breakdown,
            },
          });
          return [breakdown, toJson(insights)] as const;
        } catch (error) {
          if (isExpectedUnavailableInsight(error)) {
            return [breakdown, []] as const;
          }
          throw error;
        }
      }),
    );
    return Object.fromEntries(entries);
  }

  if (metric === "views" || metric === "reach") {
    const baseQuery = getAccountMetricQuery(metric, params.since, params.until);
    const [timeseries, followerBreakdown, mediaTypeBreakdown] = await Promise.all([
      getOptionalAccountInsight(params, metric, baseQuery),
      getOptionalAccountInsight(params, metric, {
        period: "lifetime",
        metric_type: "total_value",
        timeframe: "last_90_days",
        breakdown: "follow_type",
      }),
      getOptionalAccountInsight(params, metric, {
        period: "lifetime",
        metric_type: "total_value",
        timeframe: "last_90_days",
        breakdown: "media_product_type",
      }),
    ]);
    return {
      timeseries,
      follower_breakdown: followerBreakdown,
      media_type_breakdown: mediaTypeBreakdown,
    };
  }

  const query = getAccountMetricQuery(metric, params.since, params.until);
  try {
    const insights = await getMetaInsights({
      provider: params.provider,
      objectId: params.igUserId,
      token: params.token,
      metrics: [metric],
      query,
    });
    return toJson(insights);
  } catch (error) {
    if (!isExpectedUnavailableInsight(error)) {
      throw error;
    }
  }

  try {
    const insights = await getMetaInsights({
      provider: params.provider,
      objectId: params.igUserId,
      token: params.token,
      metrics: [metric],
      query: { ...query, metric_type: "total_value" },
    });
    return toJson(insights);
  } catch (error) {
    if (isExpectedUnavailableInsight(error)) {
      return [];
    }
    throw error;
  }
}

async function getOptionalAccountInsight(
  params: {
    provider: ResolvedMetaAccountAccess["connection"]["provider"];
    igUserId: string;
    token: string;
  },
  metric: MetaAccountInsightMetric,
  query: Record<string, string>,
): Promise<Json> {
  try {
    return toJson(
      await getMetaInsights({
        provider: params.provider,
        objectId: params.igUserId,
        token: params.token,
        metrics: [metric],
        query,
      }),
    );
  } catch (error) {
    if (isExpectedUnavailableInsight(error)) {
      return [];
    }
    throw error;
  }
}

function getAccountMetricQuery(
  metric: MetaAccountInsightMetric,
  since: number,
  until: number,
): Record<string, string> {
  if (metric === "online_followers") {
    return { period: "lifetime" };
  }
  return {
    period: "day",
    since: String(since),
    until: String(until),
  };
}

function mapMetaMedia(
  profileId: string,
  sourceScrapeId: string,
  media: MetaMedia,
  insights: MetaInsight[],
): Insertable<"ig_posts"> {
  const insightValues = new Map<string, number>();
  for (const insight of insights) {
    const numeric = getInsightNumber(insight);
    if (numeric != null && !insightValues.has(insight.name)) {
      insightValues.set(insight.name, numeric);
    }
  }
  const viewCount =
    insightValues.get("views") ??
    insightValues.get("ig_reels_aggregated_all_plays_count") ??
    null;
  const skipRate = insightValues.get("reels_skip_rate") ?? null;
  const averageWatchTimeMs =
    insightValues.get("ig_reels_avg_watch_time") ?? null;
  const videoLengthSecs = null;
  const viewBreakdown = getFollowerViewBreakdown(insights);
  const followerViewCount = viewBreakdown.followers;
  const nonFollowerViewCount = viewBreakdown.nonFollowers;

  return {
    ig_profile_id: profileId,
    source_scrape_id: sourceScrapeId,
    details_scrape_id: null,
    meta_media_id: media.id,
    uploaded_at: toIsoTimestamp(media.timestamp),
    thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
    post_url: getCanonicalInstagramPostUrl(media.permalink),
    first_frame_url: null,
    video_embed_url: media.media_type === MEDIA_TYPE_VIDEO ? media.media_url ?? null : null,
    media_type: getMediaType(media),
    carousel_image_urls:
      media.children?.data
        .map((child) => child.media_url ?? child.thumbnail_url ?? null)
        .filter((url): url is string => url !== null) ?? null,
    video_length_secs: videoLengthSecs,
    view_count: viewCount,
    save_count: insightValues.get("saved") ?? null,
    share_count: insightValues.get("shares") ?? null,
    comment_count:
      insightValues.get("comments") ?? media.comments_count ?? null,
    like_count: insightValues.get("likes") ?? media.like_count ?? null,
    description: media.caption ?? null,
    follows_count: insightValues.get("follows") ?? null,
    follower_view_count: followerViewCount,
    non_follower_view_count: nonFollowerViewCount,
    follower_non_follower_ratio: getRatio(
      followerViewCount,
      nonFollowerViewCount,
    ),
    reach_count: insightValues.get("reach") ?? null,
    hook_rate: skipRate == null ? null : PERCENT_MAX - normalizePercent(skipRate),
    average_watch_time_ms: averageWatchTimeMs,
    hold_rate:
      averageWatchTimeMs != null && videoLengthSecs
        ? (averageWatchTimeMs / (videoLengthSecs * MILLISECONDS_PER_SECOND)) *
          PERCENT_MAX
        : null,
  };
}

function getFollowerViewBreakdown(insights: MetaInsight[]): {
  followers: number | null;
  nonFollowers: number | null;
} {
  let followers: number | null = null;
  let nonFollowers: number | null = null;
  for (const insight of insights) {
    const breakdowns = insight.total_value?.breakdowns;
    if (!Array.isArray(breakdowns)) {
      continue;
    }
    for (const breakdown of breakdowns) {
      if (!isRecord(breakdown) || !Array.isArray(breakdown.results)) {
        continue;
      }
      for (const result of breakdown.results) {
        if (!isRecord(result) || !Array.isArray(result.dimension_values)) {
          continue;
        }
        const label = result.dimension_values.find(
          (value): value is string => typeof value === "string",
        )?.toLowerCase();
        const value = typeof result.value === "number" ? result.value : null;
        if (value == null) {
          continue;
        }
        if (label === "follower" || label === "followers") {
          followers = value;
        } else if (label === "non_follower" || label === "non-followers") {
          nonFollowers = value;
        }
      }
    }
  }
  return { followers, nonFollowers };
}

function getInsightNumber(insight: MetaInsight): number | null {
  const value = insight.total_value?.value ?? insight.values?.at(-1)?.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRatio(followers: number | null, nonFollowers: number | null): number | null {
  return followers != null && nonFollowers != null && nonFollowers > 0
    ? followers / nonFollowers
    : null;
}

function normalizePercent(value: number): number {
  return value <= 1 ? value * PERCENT_MAX : value;
}

function getMediaType(media: MetaMedia): "carousel" | "short" | "static" {
  if (media.media_type === MEDIA_TYPE_CAROUSEL) {
    return "carousel";
  }
  if (isReel(media)) {
    return "short";
  }
  return "static";
}

function isReel(media: MetaMedia): boolean {
  return (
    media.media_product_type === REELS_PRODUCT_TYPE ||
    media.permalink.includes("/reel/")
  );
}

function toIsoTimestamp(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

function isExpectedUnavailableInsight(error: unknown): boolean {
  return (
    error instanceof MetaApiError &&
    error.status === META_EXPECTED_INSIGHT_ERROR_STATUS &&
    error.code !== 190
  );
}

async function listExistingPosts(admin: AdminClient, profileId: string) {
  const { data, error } = await admin
    .from("ig_posts")
    .select("*")
    .eq("ig_profile_id", profileId);
  if (error) {
    throw error;
  }
  return data ?? [];
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += concurrency) {
    const batch = values.slice(index, index + concurrency);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
