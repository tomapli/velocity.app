"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, ListChecks } from "lucide-react";

import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import { DataSourceBadge, ScrapeMethodBadge } from "@/components/ig/scrape-badges";
import { ScrapeRequestExplorer } from "@/components/ig/scrape-request-explorer";
import { ScrapeStatusLink } from "@/components/ig/scrape-status-link";
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
import { formatIgDateTime } from "@/lib/ig/format";
import {
  describeJobParams,
  getIgScrapeJobProgress,
  type IgScrapeJob,
} from "@/lib/ig/groups";
import { igProfilePath, igScrapePath } from "@/lib/ig/routes";

interface ScrapeGroupListProps {
  jobs: IgScrapeJob[];
}

/**
 * Expandable list of scrapes (groups); each opens into its request pipeline.
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
  const progress = getIgScrapeJobProgress(job);

  return (
    <AccordionItem value={job.group.id}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <IgRemoteImage
                src={job.profile.profile_picture_url}
                alt=""
                className="size-9 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">@{job.profile.ig_username}</span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                    {progress.percent}%
                  </span>
                </div>
                <Progress
                  value={progress.percent}
                  aria-label={`Estimated progress ${progress.percent}%`}
                />
              </div>
            </div>
          </AccordionTrigger>
        </div>
        <ScrapeStatusLink job={job} />
      </div>
      <AccordionContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <DataSourceBadge dataSource={job.group.data_source} />
            <ScrapeMethodBadge method={job.group.scrape_method} />
            <span>{describeJobParams(job)}</span>
            <span>·</span>
            <time dateTime={job.group.created_at}>
              {formatIgDateTime(job.group.created_at)}
            </time>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href={igScrapePath(job.group.id)}>
                Scrape details
                <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={igProfilePath(job.profile.ig_username)}>
                Open profile
                <ExternalLink />
              </Link>
            </Button>
          </div>
        </div>
        <ScrapeRequestExplorer job={job} />
      </AccordionContent>
    </AccordionItem>
  );
}
