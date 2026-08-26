"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
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
  summarizeAccountInsights,
  type AccountInsightSlice,
  type AccountInsightSummary,
} from "@/lib/ig/account-insights";
import type { IgAccountInsights } from "@/lib/ig/queries";
import {
  META_ACCOUNT_INSIGHT_RANGES_DAYS,
  META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
  type MetaAccountInsightRangeDays,
  type MetaAccountInsightSummaryMetric,
} from "@/lib/meta/constants";
import { cn } from "@/lib/utils";

interface IgAccountInsightsPanelProps {
  insights: IgAccountInsights[];
  isRefreshing?: boolean;
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

const SPLIT_SLICE_OPACITIES = [1, 0.55, 0.3, 0.18] as const;
const SPLIT_LEGEND_SLICES = 3;
const DEMOGRAPHIC_SLICES = 5;
const MIN_CHART_POINTS = 2;

/**
 * Account-wide Meta insights for a selectable 15/30/90/180-day window:
 * hero cards and per-day charts for the key metrics, everything else in a
 * collapsed detail section.
 */
export function IgAccountInsightsPanel({
  insights,
  isRefreshing = false,
}: IgAccountInsightsPanelProps) {
  const [rangeDays, setRangeDays] = useState<MetaAccountInsightRangeDays>(
    META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
  );
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
              setRangeDays(Number(value) as MetaAccountInsightRangeDays);
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

      {selected == null ? (
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

          {chartSummaries.length > 0 ? (
            <div
              className={cn(
                "grid gap-3",
                chartSummaries.length > 1 && "lg:grid-cols-2",
              )}
            >
              {chartSummaries.map((summary) => (
                <MetricChartCard key={summary.metric} summary={summary} />
              ))}
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
  const slices = Object.values(summary.breakdowns)[0] ?? [];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {summary.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <p className="font-heading text-2xl tabular-nums">
          {summary.total == null ? "—" : formatInsightNumber(summary.total)}
        </p>
        {slices.length > 0 ? <MetricSplit slices={slices} color={color} /> : null}
      </CardContent>
    </Card>
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
