"use client";

import { Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  summarizeAccountInsights,
  type AccountInsightSummary,
} from "@/lib/ig/account-insights";
import type { IgAccountInsights } from "@/lib/ig/queries";

interface IgAccountInsightsProps {
  insights: IgAccountInsights;
}

const CHART_METRICS = ["views", "reach", "accounts_engaged", "follower_count"] as const;
const CHART_CONFIG = {
  views: { label: "Views", color: "var(--chart-1)" },
  reach: { label: "Reach", color: "var(--chart-2)" },
  accounts_engaged: { label: "Accounts engaged", color: "var(--chart-3)" },
  follower_count: { label: "Followers", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Account-wide Meta insights, including the available 90-day time series. */
export function IgAccountInsightsPanel({ insights }: IgAccountInsightsProps) {
  const summaries = summarizeAccountInsights(insights.metrics);
  const chartData = buildChartData(summaries);

  return (
    <section className="space-y-4" aria-labelledby="account-insights-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="account-insights-title" className="font-heading text-lg font-semibold">
            Account insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Maximum available Meta history through {new Date(insights.period_end).toLocaleDateString()}.
          </p>
        </div>
      </div>

      {chartData.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
              <LineChart data={chartData} accessibilityLayer>
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {CHART_METRICS.map((metric) => (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    stroke={`var(--color-${metric})`}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {summaries.map((summary) => (
          <Card key={summary.metric} className="gap-2 py-4">
            <CardHeader className="px-4 py-0">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {summary.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <p className="font-heading text-lg tabular-nums">{summary.displayValue}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function buildChartData(summaries: AccountInsightSummary[]): Array<Record<string, string | number>> {
  const byDate = new Map<string, Record<string, string | number>>();
  for (const summary of summaries) {
    if (!CHART_METRICS.includes(summary.metric as (typeof CHART_METRICS)[number])) {
      continue;
    }
    for (const point of summary.points) {
      const date = new Date(point.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const row = byDate.get(date) ?? { date };
      row[summary.metric] = point.value;
      byDate.set(date, row);
    }
  }
  return [...byDate.values()];
}

