import { IG_STALE_MS } from "@/lib/ig/constants";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";

export type IgScrapeStatus = "waiting" | "scraping" | "ready" | "error";

export interface IgScrapeJob {
  group: Group;
  profile: IgProfile;
  scrapes: ScheduledScrape[];
}

/**
 * Builds scrape-history jobs from group rows and their scheduled child runs.
 */
export function buildIgScrapeJobs(
  groups: Group[],
  scrapes: ScheduledScrape[],
  profiles: Map<string, IgProfile>,
): IgScrapeJob[] {
  const scrapesByGroup = new Map<string, ScheduledScrape[]>();

  for (const scrape of scrapes) {
    const current = scrapesByGroup.get(scrape.group_id) ?? [];
    current.push(scrape);
    scrapesByGroup.set(scrape.group_id, current);
  }

  return groups
    .map((group) => {
      const profile = profiles.get(group.ig_profile_id);
      if (!profile) {
        return null;
      }

      return {
        group,
        profile,
        scrapes: [...(scrapesByGroup.get(group.id) ?? [])].sort((left, right) =>
          left.created_at.localeCompare(right.created_at),
        ),
      };
    })
    .filter((job): job is IgScrapeJob => job !== null)
    .sort((left, right) => right.group.created_at.localeCompare(left.group.created_at));
}

export function getJobCreatedAt(job: IgScrapeJob): string {
  return job.group.created_at;
}

export function getJobRequestedPostCount(job: IgScrapeJob): number | null {
  return job.group.requested_post_count;
}

export function getJobSinceWhen(job: IgScrapeJob): string | null {
  return job.group.since_when;
}

export function getJobErrorMessage(job: IgScrapeJob): string | null {
  return job.scrapes.find((scrape) => scrape.error_message)?.error_message ?? null;
}

/**
 * Derives the lifecycle status of a scrape job from its scheduled rows.
 */
export function getIgScrapeJobStatus(job: IgScrapeJob): IgScrapeStatus {
  if (job.scrapes.length === 0) {
    return "waiting";
  }

  if (job.scrapes.some((scrape) => !scrape.finished_at)) {
    return job.scrapes.some((scrape) => scrape.apify_called_at)
      ? "scraping"
      : "waiting";
  }

  const listings = job.scrapes.filter(
    (scrape) => scrape.scrape_type === "posts" || scrape.scrape_type === "reels",
  );
  const details = job.scrapes.filter((scrape) => scrape.scrape_type === "post_details");
  if (details.some((scrape) => scrape.error_message)) {
    return "error";
  }
  if (listings.length > 0 && listings.every((scrape) => scrape.error_message)) {
    return "error";
  }

  return "ready";
}

export function getJobFinishedAt(job: IgScrapeJob): string | null {
  const finished = job.scrapes
    .map((scrape) => scrape.finished_at)
    .filter((value): value is string => value != null)
    .sort((left, right) => right.localeCompare(left));

  return job.scrapes.every((scrape) => scrape.finished_at) ? (finished[0] ?? null) : null;
}

/**
 * Returns true when a finished job is older than the stale threshold.
 */
export function isIgScrapeJobStale(job: IgScrapeJob, now = Date.now()): boolean {
  const finishedAt = getJobFinishedAt(job);
  if (!finishedAt) {
    return false;
  }

  const parsed = Date.parse(finishedAt);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return now - parsed > IG_STALE_MS;
}

export function upsertScheduledScrape(
  scrapes: ScheduledScrape[],
  next: ScheduledScrape,
): ScheduledScrape[] {
  return [next, ...scrapes.filter((scrape) => scrape.id !== next.id)];
}

export function upsertGroup(groups: Group[], next: Group): Group[] {
  return [next, ...groups.filter((group) => group.id !== next.id)];
}
