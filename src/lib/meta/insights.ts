import type { MetaInsight } from "@/lib/meta/api";
import type { MetaAccountInsightMetric } from "@/lib/meta/constants";

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

/** Returns requested metrics omitted from an otherwise successful Meta response. */
export function getMissingInsightMetrics(
  requestedMetrics: readonly string[],
  insights: readonly MetaInsight[],
): string[] {
  const returnedMetrics = new Set(insights.map((insight) => insight.name));
  return requestedMetrics.filter((metric) => !returnedMetrics.has(metric));
}

/** Builds every currently supported query variant for one account metric. */
export function getMetaAccountInsightRequests(
  metric: MetaAccountInsightMetric,
  since: number,
  until: number,
): MetaAccountInsightRequest[] {
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
