import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { IgScrapeStatus } from "@/lib/ig/groups";
import type { Group } from "@/lib/ig/queries";
import {
  IG_SCRAPE_METHOD_ACTOR_LABELS,
  IG_SCRAPE_METHOD_LABELS,
  type IgScrapeMethod,
} from "@/lib/ig/scrape-methods";
import {
  SCRAPE_DATA_ORIGIN_LABELS,
  type ScheduledScrapeStatus,
  type ScrapeDataOrigin,
} from "@/lib/ig/scrape-requests";
import { cn } from "@/lib/utils";

export const IG_SCRAPE_STATUS_LABELS: Record<IgScrapeStatus, string> = {
  waiting: "Waiting",
  scraping: "Scraping",
  ready: "Ready",
  error: "Error",
};

export const SCHEDULED_SCRAPE_STATUS_LABELS: Record<ScheduledScrapeStatus, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

export const DATA_SOURCE_LABELS: Record<Group["data_source"], string> = {
  public: "Public data",
  meta_hybrid: "Meta + public data",
};

const IDLE_CLASSES = "border-muted-foreground/30 text-muted-foreground";
// info and chart-3 share a hue; chart-3-strong is the text-safe variant.
const ACTIVE_CLASSES = "border-info/40 bg-info/10 text-chart-3-strong";
const SUCCESS_CLASSES = "border-success/40 bg-success/10 text-success-strong";
const FAILURE_CLASSES = "border-destructive/40 bg-destructive/10 text-destructive";

const IG_SCRAPE_STATUS_CLASSES: Record<IgScrapeStatus, string> = {
  waiting: IDLE_CLASSES,
  scraping: ACTIVE_CLASSES,
  ready: SUCCESS_CLASSES,
  error: FAILURE_CLASSES,
};

const SCHEDULED_SCRAPE_STATUS_CLASSES: Record<ScheduledScrapeStatus, string> = {
  queued: IDLE_CLASSES,
  running: ACTIVE_CLASSES,
  done: SUCCESS_CLASSES,
  failed: FAILURE_CLASSES,
};

/** Decorative spinner: the badge text already names the state. */
function StatusSpinner() {
  return <Spinner className="size-3" role="presentation" aria-label={undefined} aria-hidden />;
}

/**
 * Combined lifecycle of a scrape (group) derived from all of its requests.
 * With `href` it renders as a link to the scrape's page.
 */
export function ScrapeStatusBadge({
  status,
  className,
  href,
}: {
  status: IgScrapeStatus;
  className?: string;
  href?: string;
}) {
  const content = (
    <>
      {status === "scraping" ? <StatusSpinner /> : null}
      {IG_SCRAPE_STATUS_LABELS[status]}
    </>
  );

  if (href) {
    return (
      <Badge
        asChild
        variant="outline"
        className={cn("gap-1.5", IG_SCRAPE_STATUS_CLASSES[status], className)}
      >
        <Link href={href} title="Open scrape details">
          {content}
        </Link>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", IG_SCRAPE_STATUS_CLASSES[status], className)}
    >
      {content}
    </Badge>
  );
}

/** Lifecycle of one request (scheduled scrape) sent to Apify or the Meta API. */
export function RequestStatusBadge({ status }: { status: ScheduledScrapeStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", SCHEDULED_SCRAPE_STATUS_CLASSES[status])}
    >
      {status === "running" ? <StatusSpinner /> : null}
      {SCHEDULED_SCRAPE_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Which data sources a scrape was configured with. */
export function DataSourceBadge({ dataSource }: { dataSource: Group["data_source"] }) {
  return <Badge variant="outline">{DATA_SOURCE_LABELS[dataSource]}</Badge>;
}

/** Which Apify pipeline a scrape uses for its public post data. */
export function ScrapeMethodBadge({ method }: { method: IgScrapeMethod }) {
  return (
    <Badge variant="outline" title={IG_SCRAPE_METHOD_ACTOR_LABELS[method]}>
      {IG_SCRAPE_METHOD_LABELS[method]}
    </Badge>
  );
}

/** Whether a request downloads public (Apify) or private (Meta API) data. */
export function DataOriginBadge({ origin }: { origin: ScrapeDataOrigin }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {SCRAPE_DATA_ORIGIN_LABELS[origin]}
    </Badge>
  );
}
