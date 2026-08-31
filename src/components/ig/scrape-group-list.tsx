"use client";

import Link from "next/link";
import { ExternalLink, ListChecks } from "lucide-react";

import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import { DataSourceBadge, ScrapeStatusBadge } from "@/components/ig/scrape-badges";
import { ScrapeRequestList } from "@/components/ig/scrape-request-list";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { formatIgDate, formatIgDateTime } from "@/lib/ig/format";
import {
  getIgScrapeJobProgress,
  getIgScrapeJobStatus,
  getJobErrorMessage,
  type IgScrapeJob,
} from "@/lib/ig/groups";

interface ScrapeGroupListProps {
  jobs: IgScrapeJob[];
}

/**
 * Expandable list of scrapes (groups); each opens into its individual requests.
 */
export function ScrapeGroupList({ jobs }: ScrapeGroupListProps) {
  if (jobs.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>No scrapes yet</EmptyTitle>
          <EmptyDescription>
            Scheduled scrapes and the requests they send show up here live.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Accordion type="multiple" className="rounded-xl border px-4">
      {jobs.map((job) => (
        <ScrapeGroupItem key={job.group.id} job={job} />
      ))}
    </Accordion>
  );
}

function ScrapeGroupItem({ job }: { job: IgScrapeJob }) {
  const status = getIgScrapeJobStatus(job);
  const progress = getIgScrapeJobProgress(job);
  const errorMessage = getJobErrorMessage(job);

  return (
    <AccordionItem value={job.group.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IgRemoteImage
              src={job.profile.profile_picture_url}
              alt=""
              className="size-9 shrink-0 rounded-full"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">@{job.profile.ig_username}</span>
                <ScrapeStatusBadge status={status} />
                <DataSourceBadge dataSource={job.group.data_source} />
              </div>
              <p className="text-sm font-normal text-muted-foreground">
                {formatJobParams(job)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm font-normal text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
            <span className="tabular-nums">
              {progress.finished}/{progress.total}{" "}
              {progress.total === 1 ? "request" : "requests"} done
            </span>
            <time dateTime={job.group.created_at}>
              {formatIgDateTime(job.group.created_at)}
            </time>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        <Progress
          value={progress.percent}
          aria-label={`${progress.finished} of ${progress.total} requests done`}
        />
        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Requests
          </h3>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/ig/${job.profile.ig_username}`}>
              Open profile
              <ExternalLink />
            </Link>
          </Button>
        </div>
        <ScrapeRequestList scrapes={job.scrapes} />
      </AccordionContent>
    </AccordionItem>
  );
}

function formatJobParams(job: IgScrapeJob): string {
  if (job.group.since_when) {
    return `Posts since ${formatIgDate(job.group.since_when)}`;
  }

  if (job.group.requested_post_count != null) {
    return `${job.group.requested_post_count} posts requested`;
  }

  return "Default post count";
}
