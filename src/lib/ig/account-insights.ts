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
  follows_and_unfollows: "Follower growth",
  profile_links_taps: "Profile link taps",
  online_followers: "Online followers",
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

export interface AccountInsightWindow {
  total: number | null;
  breakdowns: Record<string, AccountInsightSlice[]>;
}

export interface AccountInsightFollowsSplit {
  follows: number | null;
  unfollows: number | null;
  net: number | null;
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
  /** Per-chunk values for ranges fetched in windows, oldest first. */
  windows: AccountInsightWindow[];
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
  // Meta returns the follows_and_unfollows total request without a value;
  // the net change has to be derived from the follow_type breakdown.
  const signed = metric === "follows_and_unfollows";
  const total =
    extractTotal(raw) ??
    (signed ? getFollowsSplit(breakdowns).net : null) ??
    points.at(-1)?.value ??
    null;
  const approximate = windowed && NON_ADDITIVE_METRICS.has(metric);
  return {
    metric,
    label: META_ACCOUNT_INSIGHT_LABELS[metric],
    total,
    displayValue:
      total == null
        ? formatStructuredValue(breakdowns)
        : `${approximate ? "~" : ""}${signed && total > 0 ? "+" : ""}${NUMBER_FORMATTER.format(total)}`,
    points,
    breakdowns,
    windows: extractWindows(raw),
  };
}

/**
 * Reads follower gains and losses from the follow_type breakdown, whose
 * dimension values are FOLLOWER (accounts that followed) and NON_FOLLOWER
 * (accounts that unfollowed).
 */
export function getFollowsSplit(
  breakdowns: Record<string, AccountInsightSlice[]>,
): AccountInsightFollowsSplit {
  let follows: number | null = null;
  let unfollows: number | null = null;
  for (const slice of breakdowns.follow_type ?? []) {
    const label = slice.label.toLowerCase();
    if (label === "non follower" || label === "unfollows") {
      unfollows = (unfollows ?? 0) + slice.value;
    } else if (label === "follower" || label === "follows") {
      follows = (follows ?? 0) + slice.value;
    }
  }
  if (follows == null && unfollows == null) {
    return { follows: null, unfollows: null, net: null };
  }
  return { follows, unfollows, net: (follows ?? 0) - (unfollows ?? 0) };
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
    const totalValue = firstNumericTotal(insights);
    if (totalValue != null) {
      sum = (sum ?? 0) + totalValue;
    }
  }
  return sum;
}

function firstNumericTotal(insights: unknown): number | null {
  if (!Array.isArray(insights)) {
    return null;
  }
  for (const insight of insights) {
    if (!isRecord(insight)) {
      continue;
    }
    const totalValue = isRecord(insight.total_value)
      ? insight.total_value.value
      : undefined;
    if (typeof totalValue === "number" && Number.isFinite(totalValue)) {
      return totalValue;
    }
  }
  return null;
}

/** Splits chunked storage keys back into ordered per-window values. */
function extractWindows(raw: unknown): AccountInsightWindow[] {
  if (!isRecord(raw)) {
    return [];
  }
  const entries = Object.entries(raw).flatMap(([key, value]) => {
    const suffix = WINDOW_SUFFIX_PATTERN.exec(key);
    return suffix ? [{ key, value, index: Number(suffix[0].slice(1)) }] : [];
  });
  if (entries.length === 0) {
    return [];
  }
  const count = Math.max(...entries.map((entry) => entry.index)) + 1;
  return Array.from({ length: count }, (_, index) => {
    const breakdowns: Record<string, AccountInsightSlice[]> = {};
    let total: number | null = null;
    for (const entry of entries) {
      if (entry.index !== index || !Array.isArray(entry.value)) {
        continue;
      }
      if (TOTAL_KEY_PATTERN.test(entry.key)) {
        total = firstNumericTotal(entry.value);
        continue;
      }
      if (entry.key.startsWith(BREAKDOWN_KEY_PREFIX)) {
        const slices = extractSlices(entry.value);
        if (slices.length > 0) {
          breakdowns[normalizeBreakdownKey(entry.key)] = slices;
        }
      }
    }
    return { total, breakdowns };
  });
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

const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface OnlineFollowersHeatmap {
  /** Average online followers per [weekday (Monday first)][UTC hour]. */
  grid: number[][];
  max: number;
}

/** Averages Meta's per-day hourly online_followers maps into a week grid. */
export function getOnlineFollowersHeatmap(
  metrics: Json,
): OnlineFollowersHeatmap | null {
  const record = isRecord(metrics) ? metrics : {};
  const makeGrid = () =>
    Array.from({ length: DAYS_PER_WEEK }, () => new Array<number>(HOURS_PER_DAY).fill(0));
  const sums = makeGrid();
  const counts = makeGrid();

  for (const insights of collectByKey(record.online_followers, TIME_SERIES_KEY_PATTERN)) {
    if (!Array.isArray(insights)) {
      continue;
    }
    for (const insight of insights) {
      if (!isRecord(insight) || !Array.isArray(insight.values)) {
        continue;
      }
      for (const point of insight.values) {
        if (!isRecord(point) || typeof point.end_time !== "string" || !isRecord(point.value)) {
          continue;
        }
        const endTime = Date.parse(point.end_time);
        if (!Number.isFinite(endTime)) {
          continue;
        }
        // end_time closes the measured day, so the hours belong to the day
        // before it; shift Sunday-first getUTCDay to Monday-first rows.
        const utcDay = new Date(endTime - MILLISECONDS_PER_DAY).getUTCDay();
        const day = (utcDay + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
        for (const [hourKey, hourValue] of Object.entries(point.value)) {
          const hour = Number(hourKey);
          const numeric = toNumber(hourValue);
          if (Number.isInteger(hour) && hour >= 0 && hour < HOURS_PER_DAY && numeric != null) {
            sums[day]![hour]! += numeric;
            counts[day]![hour]! += 1;
          }
        }
      }
    }
  }

  const grid = sums.map((row, day) =>
    row.map((sum, hour) => {
      const count = counts[day]![hour]!;
      return count > 0 ? sum / count : 0;
    }),
  );
  const max = Math.max(...grid.flat());
  return max > 0 ? { grid, max } : null;
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
