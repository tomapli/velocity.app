import type { MetaInsight } from "@/lib/meta/api";
import {
  META_ACCOUNT_INSIGHT_METRICS,
  META_ACCOUNT_INSIGHT_RANGES_DAYS,
  META_ACCOUNT_INSIGHT_WINDOW_DAYS,
  META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
  META_FOLLOWER_COUNT_MAX_RANGE_DAYS,
  type MetaAccountInsightMetric,
  type MetaAccountInsightRangeDays,
  type MetaAccountInsightSummaryMetric,
} from "@/lib/meta/constants";

const SECONDS_PER_DAY = 24 * 60 * 60;

const DEMOGRAPHIC_BREAKDOWNS = ["age", "gender", "city", "country"] as const;
const DEMOGRAPHIC_TIMEFRAMES = ["this_month", "this_week"] as const;
const MEDIA_PRODUCT_BREAKDOWN_METRICS = new Set<MetaAccountInsightMetric>([
  "views",
  "reach",
  "comments",
  "likes",
  "saves",
  "shares",
  "total_interactions",
]);

export interface MetaAccountInsightRequest {
  key: string;
  query: Readonly<Record<string, string>>;
}

export interface MetaAccountInsightStep {
  metric: MetaAccountInsightSummaryMetric;
  rangeDays: MetaAccountInsightRangeDays;
}

/**
 * Flat, ordered list of every account-insight fetch: one step per metric per
 * range window, widest (default) range first so the default view fills first.
 * Demographics are range-independent and fetched once, with the default range;
 * the follower_count day series only exists for the trailing 30 days.
 */
export function getMetaAccountInsightSteps(): MetaAccountInsightStep[] {
  const ranges = [...META_ACCOUNT_INSIGHT_RANGES_DAYS].sort(
    (left, right) => right - left,
  );
  return ranges.flatMap((rangeDays) => {
    const steps: MetaAccountInsightStep[] = META_ACCOUNT_INSIGHT_METRICS.filter(
      (metric) =>
        !metric.endsWith("_demographics") ||
        rangeDays === META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
    ).map((metric) => ({ metric, rangeDays }));
    if (rangeDays <= META_FOLLOWER_COUNT_MAX_RANGE_DAYS) {
      steps.push({ metric: "follower_count", rangeDays });
    }
    return steps;
  });
}

/** Returns requested metrics omitted from an otherwise successful Meta response. */
export function getMissingInsightMetrics(
  requestedMetrics: readonly string[],
  insights: readonly MetaInsight[],
): string[] {
  const returnedMetrics = new Set(insights.map((insight) => insight.name));
  return requestedMetrics.filter((metric) => !returnedMetrics.has(metric));
}

/**
 * Splits a Unix-second range into windows Meta accepts for day-period
 * metrics, oldest first. Windows longer than the Meta maximum are rejected
 * with a 400, so aggregated ranges are stitched from these chunks.
 */
export function splitMetaInsightWindow(
  since: number,
  until: number,
): Array<{ since: number; until: number }> {
  const windowSeconds = META_ACCOUNT_INSIGHT_WINDOW_DAYS * SECONDS_PER_DAY;
  const windows: Array<{ since: number; until: number }> = [];
  for (let end = until; end > since; end -= windowSeconds) {
    windows.push({ since: Math.max(since, end - windowSeconds), until: end });
  }
  return windows.reverse();
}

/**
 * Every query for one metric over one range, chunked into supported windows.
 * Single-window ranges keep the historic un-suffixed keys so previously
 * stored snapshots parse the same way.
 */
export function getMetaAccountInsightWindowedRequests(
  metric: MetaAccountInsightSummaryMetric,
  since: number,
  until: number,
): MetaAccountInsightRequest[] {
  if (metric.endsWith("_demographics")) {
    return getMetaAccountInsightRequests(metric, since, until);
  }
  const windows = splitMetaInsightWindow(since, until);
  return windows.flatMap((window, index) =>
    getMetaAccountInsightRequests(metric, window.since, window.until).map(
      (request) => ({
        key: windows.length > 1 ? `${request.key}_${index}` : request.key,
        query: request.query,
      }),
    ),
  );
}

/** Builds every currently supported query variant for one account metric. */
export function getMetaAccountInsightRequests(
  metric: MetaAccountInsightSummaryMetric,
  since: number,
  until: number,
): MetaAccountInsightRequest[] {
  if (metric === "follower_count") {
    // Legacy day-series metric: no metric_type parameter, values[] response.
    return [
      {
        key: "time_series",
        query: { period: "day", since: String(since), until: String(until) },
      },
    ];
  }
  if (metric.endsWith("_demographics")) {
    return DEMOGRAPHIC_TIMEFRAMES.flatMap((timeframe) =>
      DEMOGRAPHIC_BREAKDOWNS.map((breakdown) => ({
        key: `${timeframe}_${breakdown}`,
        query: {
          period: "lifetime",
          metric_type: "total_value",
          timeframe,
          breakdown,
        },
      })),
    );
  }

  const rangeQuery = {
    period: "day",
    since: String(since),
    until: String(until),
  } as const;
  const requests: MetaAccountInsightRequest[] = [
    {
      key: "total",
      query: { ...rangeQuery, metric_type: "total_value" },
    },
  ];

  if (metric === "reach") {
    requests.push({
      key: "time_series",
      query: { ...rangeQuery, metric_type: "time_series" },
    });
  }
  if (MEDIA_PRODUCT_BREAKDOWN_METRICS.has(metric)) {
    requests.push({
      key: "breakdown_media_product_type",
      query: {
        ...rangeQuery,
        metric_type: "total_value",
        breakdown: "media_product_type",
      },
    });
  }
  if (metric === "views" || metric === "reach") {
    requests.push({
      key: "breakdown_follower_type",
      query: {
        ...rangeQuery,
        metric_type: "total_value",
        breakdown: metric === "views" ? "follower_type" : "follow_type",
      },
    });
  }
  if (metric === "follows_and_unfollows") {
    requests.push({
      key: "breakdown_follow_type",
      query: {
        ...rangeQuery,
        metric_type: "total_value",
        breakdown: "follow_type",
      },
    });
  }
  if (metric === "profile_links_taps") {
    requests.push({
      key: "breakdown_contact_button_type",
      query: {
        ...rangeQuery,
        metric_type: "total_value",
        breakdown: "contact_button_type",
      },
    });
  }

  return requests;
}
