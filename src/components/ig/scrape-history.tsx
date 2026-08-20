"use client";

import Link from "next/link";
import { ExternalLink, Instagram } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  getIgScrapeJobStatus,
  getJobCreatedAt,
  getJobErrorMessage,
  getJobRequestedPostCount,
  getJobSinceWhen,
  type IgScrapeJob,
  type IgScrapeStatus,
} from "@/lib/ig/groups";
import { cn } from "@/lib/utils";

interface ScrapeHistoryProps {
  jobs: IgScrapeJob[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_LABELS: Record<IgScrapeStatus, string> = {
  waiting: "Waiting",
  scraping: "Scraping",
  ready: "Ready",
  error: "Error",
};

/**
 * Renders the global scrape queue/history with live status updates.
 */
export function ScrapeHistory({ jobs }: ScrapeHistoryProps) {
  if (jobs.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Instagram />
          </EmptyMedia>
          <EmptyTitle>No searches yet</EmptyTitle>
          <EmptyDescription>
            Scheduled scrapes show up here live for everyone signed in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {jobs.map((job) => (
        <li
          key={job.groupId}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/ig/${job.profile.ig_username}`}
                className="truncate font-medium hover:underline"
              >
                @{job.profile.ig_username}
              </Link>
              <StatusBadge job={job} />
            </div>
            <p className="text-sm text-muted-foreground">{formatJobParams(job)}</p>
            {job.profile.ig_name ? (
              <p className="truncate text-sm text-muted-foreground">
                {job.profile.ig_name}
                {job.profile.post_count != null
                  ? ` · ${job.profile.post_count} posts on profile`
                  : null}
              </p>
            ) : null}
            {getJobErrorMessage(job) ? (
              <p className="text-sm text-destructive">{getJobErrorMessage(job)}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={getJobCreatedAt(job)}>
              {DATE_FORMATTER.format(new Date(getJobCreatedAt(job)))}
            </time>
            <Link
              href={`/ig/${job.profile.ig_username}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Open
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ job }: { job: IgScrapeJob }) {
  const status = getIgScrapeJobStatus(job);

  return (
    <Badge variant="outline" className={cn("gap-1.5", STATUS_BADGE_CLASSES[status])}>
      {status === "scraping" ? <Spinner className="size-3" /> : null}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const STATUS_BADGE_CLASSES: Record<IgScrapeStatus, string> = {
  waiting: "border-muted-foreground/30 text-muted-foreground",
  scraping: "border-info/40 bg-info/10 text-info-foreground",
  ready: "border-success/40 bg-success/10 text-success-strong",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

function formatJobParams(job: IgScrapeJob): string {
  const sinceWhen = getJobSinceWhen(job);
  if (sinceWhen) {
    const date = new Date(sinceWhen);
    if (!Number.isNaN(date.getTime())) {
      return `Since ${date.toLocaleDateString()}`;
    }
  }

  const requested = getJobRequestedPostCount(job);
  if (requested != null) {
    return `${requested} posts requested`;
  }

  return "Awaiting scrape parameters";
}
