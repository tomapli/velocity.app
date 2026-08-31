"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import {
  DataSourceBadge,
  ScrapeMethodBadge,
  ScrapeStatusBadge,
} from "@/components/ig/scrape-badges";
import { ScrapeRequestExplorer } from "@/components/ig/scrape-request-explorer";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { formatIgDateTime } from "@/lib/ig/format";
import {
  describeJobParams,
  getIgScrapeJobProgress,
  getIgScrapeJobStatus,
  getJobErrorMessage,
  upsertScheduledScrape,
  type IgScrapeJob,
} from "@/lib/ig/groups";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";
import { IG_SCRAPES_PATH, igProfilePath } from "@/lib/ig/routes";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";

interface ScrapeGroupPageClientProps {
  initialJob: IgScrapeJob;
}

/**
 * One scrape (group): summary, estimated progress, and its live request pipeline.
 */
export function ScrapeGroupPageClient({ initialJob }: ScrapeGroupPageClientProps) {
  const [group, setGroup] = useState<Group>(initialJob.group);
  const [profile, setProfile] = useState<IgProfile>(initialJob.profile);
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(initialJob.scrapes);

  const job = useMemo<IgScrapeJob>(
    () => ({
      group,
      profile,
      scrapes: [...scrapes].sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
      ),
    }),
    [group, profile, scrapes],
  );

  const upsertScrape = useCallback(
    (scrape: ScheduledScrape) => {
      if (scrape.group_id !== group.id) {
        return;
      }
      setScrapes((current) => upsertScheduledScrape(current, scrape));
    },
    [group.id],
  );
  const updateGroup = useCallback(
    (next: Group) => {
      if (next.id === group.id) {
        setGroup(next);
      }
    },
    [group.id],
  );
  const updateProfile = useCallback(
    (next: IgProfile) => {
      if (next.id === profile.id) {
        setProfile(next);
      }
    },
    [profile.id],
  );

  useIgScrapesRealtime({
    onScrapeInsert: upsertScrape,
    onScrapeUpdate: upsertScrape,
    onScrapeDelete: (scrape) => {
      setScrapes((current) => current.filter((row) => row.id !== scrape.id));
    },
    onGroupUpdate: updateGroup,
    onProfileUpdate: updateProfile,
  });

  const status = getIgScrapeJobStatus(job);
  const progress = getIgScrapeJobProgress(job);
  const errorMessage = getJobErrorMessage(job);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={IG_SCRAPES_PATH}>
          <ArrowLeft />
          All scrapes
        </Link>
      </Button>

      <PageHeader
        title={`Scrape of @${profile.ig_username}`}
        description={`${describeJobParams(job)} · started ${formatIgDateTime(group.created_at)}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={igProfilePath(profile.ig_username)}>
              Open profile
              <ExternalLink />
            </Link>
          </Button>
        }
      />

      <section className="space-y-3 rounded-xl border p-4" aria-label="Scrape summary">
        <div className="flex flex-wrap items-center gap-3">
          <IgRemoteImage
            src={profile.profile_picture_url}
            alt=""
            className="size-9 shrink-0 rounded-full"
          />
          <ScrapeStatusBadge status={status} />
          <DataSourceBadge dataSource={group.data_source} />
          <ScrapeMethodBadge method={group.scrape_method} />
          <span className="text-sm text-muted-foreground tabular-nums">
            {progress.finished} of {progress.expectedTotal} expected requests done ·{" "}
            {progress.percent}%
          </span>
        </div>
        <Progress
          value={progress.percent}
          aria-label={`Estimated progress ${progress.percent}%`}
        />
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </section>

      <section className="space-y-3" aria-label="Requests">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Requests
        </h2>
        <ScrapeRequestExplorer job={job} />
      </section>
    </div>
  );
}
