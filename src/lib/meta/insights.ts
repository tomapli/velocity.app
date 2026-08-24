import type { MetaInsight } from "@/lib/meta/api";

/** Returns requested metrics omitted from an otherwise successful Meta response. */
export function getMissingInsightMetrics(
  requestedMetrics: readonly string[],
  insights: readonly MetaInsight[],
): string[] {
  const returnedMetrics = new Set(insights.map((insight) => insight.name));
  return requestedMetrics.filter((metric) => !returnedMetrics.has(metric));
}
