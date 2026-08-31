import { APIFY_DETAILS_BATCH_SIZE } from "@/lib/apify/client";
import { IG_STALE_MS } from "@/lib/ig/constants";
import { formatIgDate } from "@/lib/ig/format";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";
import {
  getExpectedListingRequestCount,
  isListingScrapeType,
  usesPostDetailsBatches,
} from "@/lib/ig/scrape-methods";
import { getScheduledScrapeProgress } from "@/lib/ig/scrape-requests";

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

/** Human-readable scrape parameters: the since-date or the requested post count. */
export function describeJobParams(job: IgScrapeJob): string {
  if (job.group.since_when) {
    return `Posts since ${formatIgDate(job.group.since_when)}`;
  }

  if (job.group.requested_post_count != null) {
    return `${job.group.requested_post_count} posts requested`;
  }

  return "Default post count";
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

  const listings = job.scrapes.filter((scrape) => isListingScrapeType(scrape.scrape_type));
  const details = job.scrapes.filter((scrape) => scrape.scrape_type === "post_details");
  const meta = job.scrapes.filter((scrape) => scrape.scrape_type === "meta");
  if (meta.some((scrape) => scrape.error_message)) {
    return "error";
  }
  if (details.some((scrape) => scrape.error_message)) {
    return "error";
  }
  if (listings.length > 0 && listings.every((scrape) => scrape.error_message)) {
    return "error";
  }

  return "ready";
}

export interface IgScrapeJobProgress {
  /** Requests that already finished (successfully or not). */
  finished: number;
  /** Requests the scrape is expected to need in total, including future batches. */
  expectedTotal: number;
  /** 0–100 estimate; only reaches 100 once every request has settled. */
  percent: number;
}

const PERCENT_MAX = 100;
const PERCENT_UNSETTLED_MAX = 99;

/**
 * Estimates how far a scrape is. Details batches are created lazily, so the
 * expected count comes from the requested post count; Meta requests contribute
 * their step progress before they finish.
 */
export function getIgScrapeJobProgress(job: IgScrapeJob): IgScrapeJobProgress {
  const listings = job.scrapes.filter((scrape) => isListingScrapeType(scrape.scrape_type));
  const details = job.scrapes.filter((scrape) => scrape.scrape_type === "post_details");
  const meta = job.scrapes.filter((scrape) => scrape.scrape_type === "meta");

  const expectedDetails = getExpectedDetailsRequestCount(job.group, details.length);
  const expectedMeta =
    job.group.data_source === "meta_hybrid" ? Math.max(meta.length, 1) : meta.length;
  const expectedTotal =
    Math.max(listings.length, getExpectedListingRequestCount(job.group.scrape_method)) +
    expectedDetails +
    expectedMeta;

  const finished = job.scrapes.filter((scrape) => scrape.finished_at).length;
  const completed = job.scrapes.reduce(
    (sum, scrape) => sum + getRequestCompletion(scrape),
    0,
  );
  const allSettled = job.scrapes.length > 0 && finished === job.scrapes.length;
  const percent = allSettled
    ? PERCENT_MAX
    : Math.min(
        PERCENT_UNSETTLED_MAX,
        Math.round((completed / expectedTotal) * PERCENT_MAX),
      );

  return { finished, expectedTotal, percent };
}

/** Details batches only exist for methods that enrich posts after listing them. */
function getExpectedDetailsRequestCount(group: Group, createdDetails: number): number {
  if (!usesPostDetailsBatches(group.scrape_method)) {
    return createdDetails;
  }

  if (group.requested_post_count != null) {
    return Math.max(
      Math.ceil(group.requested_post_count / APIFY_DETAILS_BATCH_SIZE),
      createdDetails,
    );
  }

  return Math.max(createdDetails, 1);
}

function getRequestCompletion(scrape: ScheduledScrape): number {
  if (scrape.finished_at) {
    return 1;
  }

  const progress = getScheduledScrapeProgress(scrape);
  return progress?.percent != null ? progress.percent / PERCENT_MAX : 0;
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
