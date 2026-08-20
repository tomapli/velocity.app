import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  metricToneClassName,
  type MetricTone,
  type ScoredValue,
} from "@/lib/ig/metrics";

interface IgMetricBadgeProps {
  value: ScoredValue | null;
  className?: string;
}

interface IgPlainMetricProps {
  value: string | null;
  className?: string;
}

/**
 * Color-coded metric chip. Omitted values render as an em dash.
 */
export function IgMetricBadge({ value, className }: IgMetricBadgeProps) {
  if (!value) {
    return <IgPlainMetric value={null} className={className} />;
  }

  return (
    <span
      title={value.targetLabel ? `Target ${value.targetLabel}` : undefined}
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        metricToneClassName(value.tone),
        className,
      )}
    >
      {value.formatted}
    </span>
  );
}

/**
 * Neutral compact value used for counts that have no target.
 */
export function IgPlainMetric({ value, className }: IgPlainMetricProps) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("tabular-nums text-sm", className)}>{value}</span>
  );
}

export function IgToneSurface({
  tone,
  children,
  className,
}: {
  tone: MetricTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2",
        metricToneClassName(tone),
        className,
      )}
    >
      {children}
    </div>
  );
}
