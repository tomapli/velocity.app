import {
  META_ACCOUNT_INSIGHT_SUMMARY_METRICS,
  type MetaAccountInsightSummaryMetric,
} from "@/lib/meta/constants";
import type { Json } from "@/lib/supabase/database.types";

export const META_ACCOUNT_INSIGHT_LABELS: Record<
  MetaAccountInsightSummaryMetric,
  string
> = {
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
  profile_links_taps: "Profile link taps",
  follower_demographics: "Follower demographics",
  engaged_audience_demographics: "Engaged audience demographics",
};

const BREAKDOWN_KEY_PREFIX = "breakdown_";
const STRUCTURED_PREVIEW_SLICES = 3;
/** Chunked fetches suffix their storage keys with the window index. */
const WINDOW_SUFFIX_PATTERN = /_\d+$/;
const TOTAL_KEY_PATTERN = /^total(_\d+)?$/;
const TIME_SERIES_KEY_PATTERN = /^time_series(_\d+)?$/;
/**
 * Unique-account counts cannot be exactly summed across chunked windows, so
 * their aggregated totals are shown as approximations.
 */
const NON_ADDITIVE_METRICS = new Set<MetaAccountInsightSummaryMetric>([
  "reach",
  "accounts_engaged",
]);

export interface AccountInsightPoint {
  timestamp: string;
  value: number;
}

export interface AccountInsightSlice {
  label: string;
  value: number;
}

export interface AccountInsightSummary {
  metric: MetaAccountInsightSummaryMetric;
  label: string;
  /** Range total (or the latest value for level metrics like followers). */
  total: number | null;
  displayValue: string;
  points: AccountInsightPoint[];
  /** Value splits keyed by breakdown name, largest slice first. */
  breakdowns: Record<string, AccountInsightSlice[]>;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatInsightNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

/** Parses one stored range snapshot into per-metric display data. */
export function summarizeAccountInsights(metrics: Json): AccountInsightSummary[] {
  const record = isRecord(metrics) ? metrics : {};
  return META_ACCOUNT_INSIGHT_SUMMARY_METRICS.map((metric) =>
    summarizeMetric(metric, record[metric]),
  );
}

export function getAccountInsightSummary(
  summaries: AccountInsightSummary[],
  metric: MetaAccountInsightSummaryMetric,
): AccountInsightSummary | null {
  return summaries.find((summary) => summary.metric === metric) ?? null;
}

function summarizeMetric(
  metric: MetaAccountInsightSummaryMetric,
  raw: unknown,
): AccountInsightSummary {
  // Only time_series requests carry daily data; a values[] echoed on a total
  // response would otherwise inject a range-total spike into the chart.
  const points = sortPoints(extractPoints(collectByKey(raw, TIME_SERIES_KEY_PATTERN)));
  const breakdowns = extractBreakdowns(raw);
  const windowed = isWindowed(raw);
  const total = extractTotal(raw) ?? points.at(-1)?.value ?? null;
  const approximate = windowed && NON_ADDITIVE_METRICS.has(metric);
  return {
    metric,
    label: META_ACCOUNT_INSIGHT_LABELS[metric],
    total,
    displayValue:
      total == null
        ? formatStructuredValue(breakdowns)
        : `${approximate ? "~" : ""}${NUMBER_FORMATTER.format(total)}`,
    points,
    breakdowns,
  };
}

/**
 * Reads the range total. Prefers the dedicated `total` request(s) — summing
 * across chunked windows — while a bare number (the profile-snapshot
 * follower count) is used as-is.
 */
function extractTotal(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  let sum: number | null = null;
  for (const insights of collectByKey(raw, TOTAL_KEY_PATTERN)) {
    if (!Array.isArray(insights)) {
      continue;
    }
    for (const insight of insights) {
      if (!isRecord(insight)) {
        continue;
      }
      const totalValue = isRecord(insight.total_value)
        ? insight.total_value.value
        : undefined;
      if (typeof totalValue === "number" && Number.isFinite(totalValue)) {
        sum = (sum ?? 0) + totalValue;
        break;
      }
    }
  }
  return sum;
}

function collectByKey(raw: unknown, pattern: RegExp): unknown[] {
  if (!isRecord(raw)) {
    return [];
  }
  return Object.entries(raw)
    .filter(([key]) => pattern.test(key))
    .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
    .map(([, value]) => value);
}

function isWindowed(raw: unknown): boolean {
  return isRecord(raw) && Object.keys(raw).some((key) => /^total_\d+$/.test(key));
}

/** Collects daily points from any `values[]` arrays inside the raw payload. */
function extractPoints(value: unknown): AccountInsightPoint[] {
  if (Array.isArray(value)) {
    return value.flatMap((insight) => {
      if (Array.isArray(insight)) {
        return extractPoints(insight);
      }
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

/**
 * Reads `total_value.breakdowns` splits keyed by their request name. Chunked
 * windows of the same breakdown are merged by summing slice values per label.
 */
function extractBreakdowns(raw: unknown): Record<string, AccountInsightSlice[]> {
  if (!isRecord(raw)) {
    return {};
  }
  const merged = new Map<string, Map<string, number>>();
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value) || TOTAL_KEY_PATTERN.test(key) || TIME_SERIES_KEY_PATTERN.test(key)) {
      continue;
    }
    const slices = extractSlices(value);
    if (slices.length === 0) {
      continue;
    }
    const name = normalizeBreakdownKey(key);
    const byLabel = merged.get(name) ?? new Map<string, number>();
    for (const slice of slices) {
      byLabel.set(slice.label, (byLabel.get(slice.label) ?? 0) + slice.value);
    }
    merged.set(name, byLabel);
  }
  return Object.fromEntries(
    [...merged.entries()].map(([name, byLabel]) => [
      name,
      [...byLabel.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value),
    ]),
  );
}

function extractSlices(insights: unknown[]): AccountInsightSlice[] {
  const slices: AccountInsightSlice[] = [];
  for (const insight of insights) {
    if (!isRecord(insight) || !isRecord(insight.total_value)) {
      continue;
    }
    const breakdowns = insight.total_value.breakdowns;
    if (!Array.isArray(breakdowns)) {
      continue;
    }
    for (const breakdown of breakdowns) {
      if (!isRecord(breakdown) || !Array.isArray(breakdown.results)) {
        continue;
      }
      for (const item of breakdown.results) {
        if (!isRecord(item) || !Array.isArray(item.dimension_values)) {
          continue;
        }
        const value = toNumber(item.value);
        const label = item.dimension_values
          .filter((part): part is string => typeof part === "string")
          .join(" · ");
        if (value != null && label) {
          slices.push({ label: formatSliceLabel(label), value });
        }
      }
    }
  }
  return slices.sort((left, right) => right.value - left.value);
}

function normalizeBreakdownKey(key: string): string {
  const withoutSuffix = key.replace(WINDOW_SUFFIX_PATTERN, "");
  return withoutSuffix.startsWith(BREAKDOWN_KEY_PREFIX)
    ? withoutSuffix.slice(BREAKDOWN_KEY_PREFIX.length)
    : withoutSuffix;
}

function formatStructuredValue(
  breakdowns: Record<string, AccountInsightSlice[]>,
): string {
  const slices = Object.values(breakdowns)[0]?.slice(0, STRUCTURED_PREVIEW_SLICES) ?? [];
  if (slices.length === 0) {
    return "Not provided";
  }
  return slices
    .map((slice) => `${slice.label} ${NUMBER_FORMATTER.format(slice.value)}`)
    .join(" · ");
}

function sortPoints(points: AccountInsightPoint[]): AccountInsightPoint[] {
  const byTimestamp = new Map(points.map((point) => [point.timestamp, point]));
  return [...byTimestamp.values()].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/** REEL → Reel, NON_FOLLOWER → Non follower; short codes like CZ stay as-is. */
function formatSliceLabel(value: string): string {
  const spaced = value.replaceAll("_", " ");
  if (spaced !== spaced.toUpperCase()) {
    return spaced;
  }
  if (spaced.length <= 3) {
    return spaced;
  }
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
