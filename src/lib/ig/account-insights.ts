import {
  META_ACCOUNT_INSIGHT_METRICS,
  type MetaAccountInsightMetric,
} from "@/lib/meta/constants";
import type { Json } from "@/lib/supabase/database.types";

export const META_ACCOUNT_INSIGHT_LABELS: Record<MetaAccountInsightMetric, string> = {
  follower_count: "Followers",
  views: "Views",
  reach: "Reach",
  accounts_engaged: "Accounts engaged",
  total_interactions: "Total interactions",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  replies: "Replies",
  reposts: "Reposts",
  follows_and_unfollows: "Follows and unfollows",
  profile_views: "Profile views",
  profile_links_taps: "Profile link taps",
  website_clicks: "Website clicks",
  online_followers: "Online followers",
  follower_demographics: "Follower demographics",
  reached_audience_demographics: "Reached audience demographics",
  engaged_audience_demographics: "Engaged audience demographics",
  content_views: "Content views",
};

export interface AccountInsightPoint {
  timestamp: string;
  value: number;
}

export interface AccountInsightSummary {
  metric: MetaAccountInsightMetric;
  label: string;
  displayValue: string;
  numericValue: number | null;
  points: AccountInsightPoint[];
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function summarizeAccountInsights(metrics: Json): AccountInsightSummary[] {
  const record = isRecord(metrics) ? metrics : {};
  return META_ACCOUNT_INSIGHT_METRICS.map((metric) => {
    const raw = record[metric];
    const points = extractPoints(raw);
    const latest = points.at(-1)?.value ?? extractFirstNumber(raw);
    return {
      metric,
      label: META_ACCOUNT_INSIGHT_LABELS[metric],
      displayValue: latest == null ? formatStructuredValue(raw) : NUMBER_FORMATTER.format(latest),
      numericValue: latest,
      points,
    };
  });
}

function extractPoints(value: unknown): AccountInsightPoint[] {
  if (Array.isArray(value)) {
    return value.flatMap((insight) => {
      if (!isRecord(insight) || !Array.isArray(insight.values)) {
        return [];
      }
      return insight.values.flatMap((point) => {
        if (!isRecord(point) || typeof point.end_time !== "string") {
          return [];
        }
        const numeric = toNumber(point.value);
        return numeric == null ? [] : [{ timestamp: point.end_time, value: numeric }];
      });
    });
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(extractPoints);
  }
  return [];
}

function extractFirstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFirstNumber(item);
      if (found != null) {
        return found;
      }
    }
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found = extractFirstNumber(item);
      if (found != null) {
        return found;
      }
    }
  }
  return null;
}

function formatStructuredValue(value: unknown): string {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return "Not provided";
  }
  const pairs = collectNumericPairs(value).slice(0, 3);
  if (pairs.length === 0) {
    return "Available";
  }
  return pairs
    .map(([key, numeric]) => `${humanizeKey(key)} ${NUMBER_FORMATTER.format(numeric)}`)
    .join(" · ");
}

function collectNumericPairs(value: unknown, key = "value"): Array<[string, number]> {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [[key, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNumericPairs(item, key));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([childKey, item]) =>
      collectNumericPairs(item, childKey),
    );
  }
  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function humanizeKey(value: string): string {
  return value.replaceAll("_", " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
