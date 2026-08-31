"use client";

import {
  DataOriginBadge,
  RequestStatusBadge,
} from "@/components/ig/scrape-badges";
import { Progress } from "@/components/ui/progress";
import { formatIgDateTime, formatIgDuration } from "@/lib/ig/format";
import type { ScheduledScrape } from "@/lib/ig/queries";
import {
  SCRAPE_TYPE_DESCRIPTIONS,
  SCRAPE_TYPE_LABELS,
  getMetaScrapeState,
  getScheduledScrapeErrorMessage,
  getScheduledScrapeProgress,
  getScheduledScrapeStatus,
  getScrapeDataOrigin,
} from "@/lib/ig/scrape-requests";

interface ScrapeRequestDetailsProps {
  scrape: ScheduledScrape;
}

/**
 * Full detail of one request sent to Apify or the Meta API, with its live state.
 */
export function ScrapeRequestDetails({ scrape }: ScrapeRequestDetailsProps) {
  const status = getScheduledScrapeStatus(scrape);
  const progress = getScheduledScrapeProgress(scrape);
  const errorMessage = getScheduledScrapeErrorMessage(scrape);
  const metaState = getMetaScrapeState(scrape);
  const startedAt = scrape.scrape_type === "meta" ? scrape.created_at : scrape.apify_called_at;
  const duration = formatIgDuration(startedAt, scrape.finished_at);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{SCRAPE_TYPE_LABELS[scrape.scrape_type]}</span>
        <DataOriginBadge origin={getScrapeDataOrigin(scrape)} />
        <RequestStatusBadge status={status} />
      </div>
      <p className="text-sm text-muted-foreground">
        {SCRAPE_TYPE_DESCRIPTIONS[scrape.scrape_type]}
      </p>

      {progress ? (
        <div className="space-y-1.5">
          <p className="text-sm">{progress.label}</p>
          {progress.percent != null ? (
            <Progress value={progress.percent} aria-label={progress.label} />
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatIgDateTime(scrape.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {scrape.scrape_type === "meta" ? "Last step" : "Apify called"}
          </dt>
          <dd>
            {formatIgDateTime(
              scrape.scrape_type === "meta" ? scrape.updated_at : scrape.apify_called_at,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Finished</dt>
          <dd>
            {formatIgDateTime(scrape.finished_at)}
            {duration ? (
              <span className="text-muted-foreground"> · {duration}</span>
            ) : null}
          </dd>
        </div>
        {scrape.apify_run_id ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground">Apify run</dt>
            <dd className="truncate font-mono" title={scrape.apify_run_id}>
              {scrape.apify_run_id}
            </dd>
          </div>
        ) : null}
        {metaState ? (
          <>
            <div>
              <dt className="text-muted-foreground">Insights window</dt>
              <dd>
                {formatIgDateTime(metaState.period_start)} –{" "}
                {formatIgDateTime(metaState.period_end)}
              </dd>
            </div>
            {metaState.attempts > 0 ? (
              <div>
                <dt className="text-muted-foreground">Retries</dt>
                <dd>{metaState.attempts}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {errorMessage ? (
        <p className="text-sm text-destructive" role={status === "failed" ? "alert" : undefined}>
          {status === "failed" ? errorMessage : `Last attempt failed, retrying: ${errorMessage}`}
        </p>
      ) : null}
    </div>
  );
}
