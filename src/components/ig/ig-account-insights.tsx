"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatInsightNumber,
  getAccountInsightSummary,
  getFollowsSplit,
  getOnlineFollowersHeatmap,
  INSIGHTS_TIME_ZONE_LABEL,
  summarizeAccountInsights,
  type AccountInsightSlice,
  type AccountInsightSummary,
  type OnlineFollowersHeatmap,
} from "@/lib/ig/account-insights";
import type { IgAccountInsights } from "@/lib/ig/queries";
import {
  META_ACCOUNT_INSIGHT_RANGES_DAYS,
  META_ACCOUNT_INSIGHT_WINDOW_DAYS,
  META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
  type MetaAccountInsightRangeDays,
  type MetaAccountInsightSummaryMetric,
} from "@/lib/meta/constants";
import { cn } from "@/lib/utils";

interface HeatmapCell {
  day: number;
  hour: number;
}

interface IgAccountInsightsPanelProps {
  insights: IgAccountInsights[];
  isRefreshing?: boolean;
  loadingRangeDays?: MetaAccountInsightRangeDays | number | null;
  onRangeRequest?: (periodDays: MetaAccountInsightRangeDays) => void;
  /** Controls the range externally so the page can filter other views by it. */
  rangeDays?: MetaAccountInsightRangeDays;
  onRangeDaysChange?: (periodDays: MetaAccountInsightRangeDays) => void;
}

/** Key metrics shown as always-visible cards with their value splits. */
const HERO_METRICS = [
  "views",
  "reach",
  "total_interactions",
  "follows_and_unfollows",
] as const;

/** Metrics charted per day whenever Meta returned a time series. */
const CHART_METRICS = [
  "reach",
  "views",
  "follower_count",
  "accounts_engaged",
  "total_interactions",
] as const;

/** Everything else lives in the collapsed detail section. */
const DETAIL_METRICS = [
  "accounts_engaged",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "reposts",
  "profile_links_taps",
  "follower_count",
] as const;

/** Fixed hue per metric family — one hue keeps one meaning across the page. */
const METRIC_COLORS: Partial<Record<MetaAccountInsightSummaryMetric, string>> = {
  views: "var(--chart-1)",
  reach: "var(--chart-2)",
  accounts_engaged: "var(--chart-3)",
  follower_count: "var(--chart-4)",
  follows_and_unfollows: "var(--chart-4)",
  total_interactions: "var(--chart-5)",
};

/** Metrics that get a per-window trend chart on chunked (90/180-day) ranges. */
const WINDOW_CHART_METRICS = ["views", "total_interactions"] as const;

const SPLIT_SLICE_OPACITIES = [1, 0.55, 0.3, 0.18] as const;
const SPLIT_LEGEND_SLICES = 3;
const DEMOGRAPHIC_SLICES = 5;
const MIN_CHART_POINTS = 2;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const HEATMAP_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HEATMAP_HOUR_TICKS = [0, 6, 12, 18] as const;
const HOURS_IN_DAY = 24;
/** Columns at each edge whose tooltip is aligned inward instead of centred. */
const HEATMAP_EDGE_COLUMNS = 2;
/** Cells stay faintly visible at zero so the week grid keeps its shape. */
const HEATMAP_MIN_OPACITY = 0.08;
/**
 * Online-follower counts sit on a high all-day baseline with a comparatively
 * small evening bump, so a linear ramp renders most of the day identically.
 * Easing the scale keeps the ordering honest while separating the busy hours.
 */
const HEATMAP_CONTRAST_EXPONENT = 3;

/**
 * Account-wide Meta insights for a selectable 15/30/90/180-day window:
 * hero cards and per-day charts for the key metrics, everything else in a
 * collapsed detail section.
 */
export function IgAccountInsightsPanel({
  insights,
  isRefreshing = false,
  loadingRangeDays = null,
  onRangeRequest,
  rangeDays: controlledRangeDays,
  onRangeDaysChange,
}: IgAccountInsightsPanelProps) {
  const [internalRangeDays, setInternalRangeDays] =
    useState<MetaAccountInsightRangeDays>(META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS);
  const rangeDays = controlledRangeDays ?? internalRangeDays;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selected =
    insights.find((row) => row.period_days === rangeDays) ?? null;
  // Demographics are range-independent and only stored on the default window.
  const demographicsRow =
    insights.find(
      (row) => row.period_days === META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
    ) ?? selected;

  const summaries = useMemo(
    () => (selected ? summarizeAccountInsights(selected.metrics) : []),
    [selected],
  );
  const demographicSummaries = useMemo(
    () => (demographicsRow ? summarizeAccountInsights(demographicsRow.metrics) : []),
    [demographicsRow],
  );

  const chartSummaries = CHART_METRICS.map((metric) =>
    getAccountInsightSummary(summaries, metric),
  ).filter(
    (summary): summary is AccountInsightSummary =>
      summary != null && summary.points.length >= MIN_CHART_POINTS,
  );

  const windowRanges = selected
    ? getWindowRanges(selected.period_end, selected.period_days)
    : [];
  const heatmap = useMemo(
    () => (demographicsRow ? getOnlineFollowersHeatmap(demographicsRow.metrics) : null),
    [demographicsRow],
  );

  const chartCards: ReactNode[] = chartSummaries.map((summary) => (
    <MetricChartCard key={`daily-${summary.metric}`} summary={summary} />
  ));
  for (const metric of WINDOW_CHART_METRICS) {
    const summary = getAccountInsightSummary(summaries, metric);
    if (summary && summary.windows.length > 1 && summary.windows.some((window) => window.total != null)) {
      chartCards.push(
        <MetricWindowChartCard
          key={`windows-${metric}`}
          summary={summary}
          windowRanges={windowRanges}
        />,
      );
    }
  }
  const growthData = buildGrowthData(
    getAccountInsightSummary(summaries, "follows_and_unfollows"),
    windowRanges,
  );
  if (growthData.length > 1) {
    chartCards.push(<FollowerGrowthChartCard key="growth" data={growthData} />);
  }
  if (heatmap) {
    chartCards.push(<OnlineFollowersCard key="online-followers" heatmap={heatmap} />);
  }

  return (
    <section className="space-y-4" aria-labelledby="account-insights-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="account-insights-title" className="font-heading text-lg font-semibold">
            Account insights
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Last {rangeDays} days
            {selected
              ? ` · through ${new Date(selected.period_end).toLocaleDateString()}`
              : null}
            {isRefreshing ? (
              <span className="inline-flex items-center gap-1">
                <Spinner className="size-3" aria-hidden />
                Updating from Meta…
              </span>
            ) : null}
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Insights time range"
          value={String(rangeDays)}
          onValueChange={(value) => {
            if (value) {
              const nextRange = Number(value) as MetaAccountInsightRangeDays;
              setInternalRangeDays(nextRange);
              onRangeDaysChange?.(nextRange);
              if (!insights.some((row) => row.period_days === nextRange)) {
                onRangeRequest?.(nextRange);
              }
            }
          }}
        >
          {META_ACCOUNT_INSIGHT_RANGES_DAYS.map((days) => (
            <ToggleGroupItem key={days} value={String(days)}>
              {days}d
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {selected == null && loadingRangeDays === rangeDays ? (
        <Empty className="border">
          <EmptyHeader>
            <Spinner />
            <EmptyTitle>Loading {rangeDays}-day insights</EmptyTitle>
            <EmptyDescription>
              This range is downloaded only when you open it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : selected == null ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No {rangeDays}-day insights yet</EmptyTitle>
            <EmptyDescription>
              {isRefreshing
                ? "This window is being collected from Meta right now — it appears here as soon as it lands."
                : "This window is collected the next time insights refresh."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {HERO_METRICS.map((metric) => {
              const summary = getAccountInsightSummary(summaries, metric);
              return summary ? (
                <HeroMetricCard key={metric} summary={summary} />
              ) : null;
            })}
          </div>

          {chartCards.length > 0 ? (
            <div
              className={cn("grid gap-3", chartCards.length > 1 && "lg:grid-cols-2")}
            >
              {chartCards}
            </div>
          ) : null}

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    detailsOpen && "rotate-180",
                  )}
                  aria-hidden
                />
                {detailsOpen ? "Hide detailed metrics" : "Show detailed metrics"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {DETAIL_METRICS.map((metric) => {
                  const summary = getAccountInsightSummary(summaries, metric);
                  return summary ? (
                    <DetailMetricTile key={metric} summary={summary} />
                  ) : null;
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(
                  [
                    "follower_demographics",
                    "engaged_audience_demographics",
                  ] as const
                ).map((metric) => {
                  const summary = getAccountInsightSummary(
                    demographicSummaries,
                    metric,
                  );
                  return summary ? (
                    <DemographicsCard key={metric} summary={summary} />
                  ) : null;
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </section>
  );
}

function HeroMetricCard({ summary }: { summary: AccountInsightSummary }) {
  const color = METRIC_COLORS[summary.metric] ?? "var(--chart-5)";
  const isGrowth = summary.metric === "follows_and_unfollows";
  const slices = isGrowth ? [] : Object.values(summary.breakdowns)[0] ?? [];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {summary.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <p className="font-heading text-2xl tabular-nums">
          {summary.total == null ? "—" : summary.displayValue}
        </p>
        {isGrowth ? <FollowsBreakdown summary={summary} /> : null}
        {slices.length > 0 ? <MetricSplit slices={slices} color={color} /> : null}
      </CardContent>
    </Card>
  );
}

/** Follower gains and losses; a parts-of-whole split would misread this metric. */
function FollowsBreakdown({ summary }: { summary: AccountInsightSummary }) {
  const split = getFollowsSplit(summary.breakdowns);
  if (split.follows == null && split.unfollows == null) {
    return null;
  }
  return (
    <ul className="space-y-1 text-xs tabular-nums">
      {split.follows != null ? (
        <li className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Follows</span>
          <span className="text-success-strong">
            +{formatInsightNumber(split.follows)}
          </span>
        </li>
      ) : null}
      {split.unfollows != null ? (
        <li className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Unfollows</span>
          <span className="text-destructive">
            −{formatInsightNumber(split.unfollows)}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/** Horizontal split of one metric's value with a short direct-labeled legend. */
function MetricSplit({
  slices,
  color,
}: {
  slices: AccountInsightSlice[];
  color: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return null;
  }
  const visible = slices.slice(0, SPLIT_SLICE_OPACITIES.length);

  return (
    <div className="space-y-2">
      <div className="flex h-1.5 gap-0.5" aria-hidden>
        {visible.map((slice, index) => (
          <div
            key={slice.label}
            className="min-w-1 rounded-full"
            style={{
              width: `${(slice.value / total) * 100}%`,
              backgroundColor: color,
              opacity: SPLIT_SLICE_OPACITIES[index],
            }}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {visible.slice(0, SPLIT_LEGEND_SLICES).map((slice, index) => (
          <li
            key={slice.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color, opacity: SPLIT_SLICE_OPACITIES[index] }}
                aria-hidden
              />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="tabular-nums">{formatInsightNumber(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricChartCard({ summary }: { summary: AccountInsightSummary }) {
  const color = METRIC_COLORS[summary.metric] ?? "var(--chart-5)";
  const data = summary.points.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: point.value,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{summary.label} per day</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ value: { label: summary.label, color } }}
          className="h-56 w-full"
        >
          <AreaChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => formatInsightNumber(value)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface WindowRange {
  start: Date;
  end: Date;
}

/** Oldest-first ≤30-day fetch windows covering a range. */
function getWindowRanges(periodEnd: string, periodDays: number): WindowRange[] {
  const endMs = Date.parse(periodEnd);
  const startMs = endMs - periodDays * MILLISECONDS_PER_DAY;
  const windowMs = META_ACCOUNT_INSIGHT_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  const ranges: WindowRange[] = [];
  for (let end = endMs; end > startMs; end -= windowMs) {
    ranges.push({
      start: new Date(Math.max(startMs, end - windowMs)),
      end: new Date(end),
    });
  }
  return ranges.reverse();
}

/** Axis label: only the months a window spans, e.g. "Feb–Mar". */
function formatWindowLabel(range: WindowRange | undefined, index: number): string {
  if (!range) {
    return `#${index + 1}`;
  }
  const start = range.start.toLocaleDateString(undefined, { month: "short" });
  const end = range.end.toLocaleDateString(undefined, { month: "short" });
  return start === end ? start : `${start}–${end}`;
}

/** Exact window dates, kept for the tooltip where there is room for them. */
function formatWindowRange(range: WindowRange | undefined): string | undefined {
  if (!range) {
    return undefined;
  }
  const format = (value: Date) =>
    value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${format(range.start)} – ${format(range.end)}`;
}

/** Reads the exact date range a hovered bar was built from. */
function readWindowRange(
  items: ReadonlyArray<{ payload?: unknown }>,
): string | null {
  const payload = items[0]?.payload;
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const range = (payload as { range?: unknown }).range;
  return typeof range === "string" ? range : null;
}

/** One bar per 30-day fetch window — the trend view for total-only metrics. */
function MetricWindowChartCard({
  summary,
  windowRanges,
}: {
  summary: AccountInsightSummary;
  windowRanges: WindowRange[];
}) {
  const color = METRIC_COLORS[summary.metric] ?? "var(--chart-5)";
  const data = summary.windows.map((window, index) => ({
    label: formatWindowLabel(windowRanges[index], index),
    range: formatWindowRange(windowRanges[index]),
    value: window.total ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{summary.label} per 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ value: { label: summary.label, color } }}
          className="h-56 w-full"
        >
          <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => formatInsightNumber(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_value, items) => readWindowRange(items)}
                />
              }
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface GrowthDatum {
  label: string;
  range: string | undefined;
  follows: number;
  unfollows: number;
}

function buildGrowthData(
  summary: AccountInsightSummary | null,
  windowRanges: WindowRange[],
): GrowthDatum[] {
  if (!summary || summary.windows.length < 2) {
    return [];
  }
  const data = summary.windows.map((window, index) => {
    const split = getFollowsSplit(window.breakdowns);
    return {
      label: formatWindowLabel(windowRanges[index], index),
      range: formatWindowRange(windowRanges[index]),
      follows: split.follows ?? 0,
      // Losses plot below the zero line.
      unfollows: -(split.unfollows ?? 0),
    };
  });
  return data.some((row) => row.follows !== 0 || row.unfollows !== 0) ? data : [];
}

/** Diverging gains/losses bars per 30-day window. */
function FollowerGrowthChartCard({ data }: { data: GrowthDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Follower growth per 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            follows: { label: "Follows", color: "var(--success)" },
            unfollows: { label: "Unfollows", color: "var(--destructive)" },
          }}
          className="h-56 w-full"
        >
          <BarChart
            data={data}
            accessibilityLayer
            stackOffset="sign"
            margin={{ left: 0, right: 8 }}
          >
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => formatInsightNumber(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_value, items) => readWindowRange(items)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="follows"
              stackId="growth"
              fill="var(--color-follows)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="unfollows"
              stackId="growth"
              fill="var(--color-unfollows)"
              radius={[0, 0, 4, 4]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Scales a cell across the observed range rather than from zero: audiences
 * keep a high all-day baseline, so a zero-based ramp would render nearly
 * every hour at the same intensity.
 */
function getHeatmapOpacity(value: number, heatmap: OnlineFollowersHeatmap): number {
  const span = heatmap.max - heatmap.min;
  const share = span > 0 ? (value - heatmap.min) / span : 1;
  return (
    HEATMAP_MIN_OPACITY +
    (1 - HEATMAP_MIN_OPACITY) * share ** HEATMAP_CONTRAST_EXPONENT
  );
}

/** Hour-by-weekday presence heatmap from the trailing-month hourly data. */
function OnlineFollowersCard({ heatmap }: { heatmap: OnlineFollowersHeatmap }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const peaks = heatmap.grid.map(getBusiestHour);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">When followers are online</CardTitle>
        <p className="text-xs text-muted-foreground">
          Average per hour · {INSIGHTS_TIME_ZONE_LABEL} · last 30 days
        </p>
      </CardHeader>
      <CardContent className="space-y-1" onMouseLeave={() => setHovered(null)}>
        {heatmap.grid.map((row, day) => (
          <div key={HEATMAP_DAY_LABELS[day]} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-muted-foreground">
              {HEATMAP_DAY_LABELS[day]}
            </span>
            <div
              className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5"
              role="img"
              aria-label={`${HEATMAP_DAY_LABELS[day]}: busiest at ${peaks[day]}:00, about ${formatInsightNumber(row[peaks[day]!] ?? 0)} followers online`}
            >
              {row.map((value, hour) => {
                const isHovered = hovered?.day === day && hovered.hour === hour;
                return (
                  <div
                    key={hour}
                    className={cn(
                      "relative h-4 rounded-xs",
                      isHovered && "ring-2 ring-foreground/50",
                    )}
                    onMouseEnter={() => setHovered({ day, hour })}
                  >
                    <div
                      className="absolute inset-0 rounded-xs"
                      style={{
                        backgroundColor: "var(--chart-3)",
                        opacity: getHeatmapOpacity(value, heatmap),
                      }}
                    />
                    {isHovered ? (
                      <HeatmapTooltip day={day} hour={hour} value={value} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span className="w-8 shrink-0" aria-hidden />
          <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 text-[10px] text-muted-foreground">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center">
                {HEATMAP_HOUR_TICKS.includes(hour as (typeof HEATMAP_HOUR_TICKS)[number])
                  ? hour
                  : ""}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Matches the chart tooltips, anchored to the hovered cell. */
function HeatmapTooltip({
  day,
  hour,
  value,
}: HeatmapCell & { value: number }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-20 w-max rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        // The top row has no room above it, and the outermost columns would
        // otherwise overflow the card.
        day === 0 ? "top-full mt-1" : "bottom-full mb-1",
        hour <= HEATMAP_EDGE_COLUMNS && "left-0",
        hour >= HOURS_IN_DAY - 1 - HEATMAP_EDGE_COLUMNS && "right-0",
        hour > HEATMAP_EDGE_COLUMNS &&
          hour < HOURS_IN_DAY - 1 - HEATMAP_EDGE_COLUMNS &&
          "left-1/2 -translate-x-1/2",
      )}
    >
      <p className="font-medium">
        {HEATMAP_DAY_LABELS[day]} {String(hour).padStart(2, "0")}:00
      </p>
      <p className="text-muted-foreground">
        ~
        <span className="font-mono font-medium tabular-nums text-foreground">
          {Math.round(value).toLocaleString()}
        </span>{" "}
        online
      </p>
    </div>
  );
}

function getBusiestHour(row: number[]): number {
  return row.reduce(
    (best, value, hour) => (value > (row[best] ?? 0) ? hour : best),
    0,
  );
}

function DetailMetricTile({ summary }: { summary: AccountInsightSummary }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {summary.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="font-heading text-lg tabular-nums">
          {summary.total == null ? "Not provided" : formatInsightNumber(summary.total)}
        </p>
      </CardContent>
    </Card>
  );
}

function DemographicsCard({ summary }: { summary: AccountInsightSummary }) {
  const countries = summary.breakdowns.this_month_country ?? [];
  const ages = summary.breakdowns.this_month_age ?? [];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {summary.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {countries.length === 0 && ages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not provided by Meta for this account.
          </p>
        ) : (
          <>
            <DemographicList title="Top countries" slices={countries} />
            <DemographicList title="Age groups" slices={ages} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DemographicList({
  title,
  slices,
}: {
  title: string;
  slices: AccountInsightSlice[];
}) {
  if (slices.length === 0) {
    return null;
  }
  const visible = slices.slice(0, DEMOGRAPHIC_SLICES);
  const max = visible[0]?.value ?? 0;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {visible.map((slice) => (
          <li key={slice.label} className="space-y-0.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{slice.label}</span>
              <span className="tabular-nums">{formatInsightNumber(slice.value)}</span>
            </div>
            <div className="h-1 rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-muted-foreground/50"
                style={{ width: max > 0 ? `${(slice.value / max) * 100}%` : 0 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
