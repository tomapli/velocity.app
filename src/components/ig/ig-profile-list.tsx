"use client";

import Link from "next/link";
import { ExternalLink, Instagram } from "lucide-react";

import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import { DataSourceBadge } from "@/components/ig/scrape-badges";
import { ScrapeStatusLink } from "@/components/ig/scrape-status-link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatIgDateTime } from "@/lib/ig/format";
import type { IgProfileOverview } from "@/lib/ig/profile-overviews";

interface IgProfileListProps {
  overviews: IgProfileOverview[];
}

const COUNT_FORMATTER = new Intl.NumberFormat();

/**
 * Lists every Instagram profile in the workspace with its latest scrape state.
 */
export function IgProfileList({ overviews }: IgProfileListProps) {
  if (overviews.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Instagram />
          </EmptyMedia>
          <EmptyTitle>No profiles yet</EmptyTitle>
          <EmptyDescription>
            Search a username above to schedule its first scrape. Profiles show up
            here live for everyone signed in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {overviews.map(({ profile, latestJob, scrapeCount }) => (
        <li
          key={profile.id}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <IgRemoteImage
              src={profile.profile_picture_url}
              alt=""
              className="size-10 shrink-0 rounded-full"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/ig/${profile.ig_username}`}
                  className="truncate font-medium hover:underline"
                >
                  @{profile.ig_username}
                </Link>
                {latestJob ? (
                  <>
                    <ScrapeStatusLink job={latestJob} />
                    <DataSourceBadge dataSource={latestJob.group.data_source} />
                  </>
                ) : null}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {formatProfileSummary(profile)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
            <span>{formatScrapeSummary(latestJob?.group.created_at ?? null, scrapeCount)}</span>
            <Link
              href={`/ig/${profile.ig_username}`}
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

function formatProfileSummary(profile: IgProfileOverview["profile"]): string {
  const parts: string[] = [];
  if (profile.ig_name) {
    parts.push(profile.ig_name);
  }
  if (profile.follower_count != null) {
    parts.push(`${COUNT_FORMATTER.format(profile.follower_count)} followers`);
  }
  if (profile.post_count != null) {
    parts.push(`${COUNT_FORMATTER.format(profile.post_count)} posts`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Profile details arrive with the first scrape";
}

function formatScrapeSummary(latestScrapedAt: string | null, scrapeCount: number): string {
  if (!latestScrapedAt) {
    return "No scrapes yet";
  }

  const countLabel = `${scrapeCount} ${scrapeCount === 1 ? "scrape" : "scrapes"}`;
  return `${countLabel} · last ${formatIgDateTime(latestScrapedAt)}`;
}
