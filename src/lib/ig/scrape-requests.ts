import { APIFY_DETAILS_BATCH_SIZE } from "@/lib/apify/client";
import { getDetailsScrapePostUrls } from "@/lib/ig/details-scrape-state";
import type { ScheduledScrape } from "@/lib/ig/queries";
import { getMetaAccountInsightSteps } from "@/lib/meta/insights";
import {
  MetaScrapeStateSchema,
  type MetaScrapeState,
} from "@/lib/meta/scrape-state";

/** Lifecycle of one request (a `scheduled_scrapes` row) inside a scrape. */
export type ScheduledScrapeStatus = "queued" | "running" | "done" | "failed";

export type ScheduledScrapeType = ScheduledScrape["scrape_type"];

/** Whether a request pulls public data (Apify) or private data (Meta API). */
export type ScrapeDataOrigin = "public" | "private";

export interface ScheduledScrapeProgress {
  label: string;
  /** 0–100 when the total amount of work is known, otherwise null. */
  percent: number | null;
}

const PERCENT_MAX = 100;

/** Meta pipeline phases that run before the per-metric account insight steps. */
const META_PHASES_BEFORE_INSIGHTS = 2;

export const SCRAPE_TYPE_LABELS: Record<ScheduledScrapeType, string> = {
  posts: "Posts listing",
  reels: "Reels listing",
  post_details: "Post details",
  meta: "Meta insights",
  profile_posts: "Profile posts",
};

export const SCRAPE_TYPE_DESCRIPTIONS: Record<ScheduledScrapeType, string> = {
  posts: "Apify run listing the profile's recent posts.",
  reels: "Apify run listing the profile's recent reels.",
  post_details: `Apify run enriching up to ${APIFY_DETAILS_BATCH_SIZE} listed posts with detailed metrics.`,
  meta: "Meta Graph API steps: media, then profile, then account insights.",
  profile_posts:
    "Apify run (data-slayer/instagram-posts) listing the profile's posts and reels with their metrics in one go.",
};

export const SCRAPE_DATA_ORIGIN_LABELS: Record<ScrapeDataOrigin, string> = {
  public: "Public · Apify",
  private: "Private · Meta API",
};

const META_PHASE_LABELS: Record<MetaScrapeState["phase"], string> = {
  media: "Importing media",
  profile: "Refreshing profile",
  account_insights: "Collecting account insights",
};

export function getScrapeDataOrigin(scrape: ScheduledScrape): ScrapeDataOrigin {
  return scrape.scrape_type === "meta" ? "private" : "public";
}

/** Parses the durable Meta pipeline state, or null for non-Meta / unreadable rows. */
export function getMetaScrapeState(scrape: ScheduledScrape): MetaScrapeState | null {
  if (scrape.scrape_type !== "meta") {
    return null;
  }

  const parsed = MetaScrapeStateSchema.safeParse(scrape.state);
  return parsed.success ? parsed.data : null;
}

/**
 * Derives the lifecycle of a single request. Apify requests start when a run is
 * called; Meta requests start once the queue worker persists its first step.
 */
export function getScheduledScrapeStatus(
  scrape: ScheduledScrape,
): ScheduledScrapeStatus {
  if (scrape.finished_at) {
    return scrape.error_message ? "failed" : "done";
  }

  if (scrape.scrape_type === "meta") {
    return hasMetaScrapeStarted(scrape) ? "running" : "queued";
  }

  return scrape.apify_called_at ? "running" : "queued";
}

/** Describes how far a request has progressed, when the row carries that detail. */
export function getScheduledScrapeProgress(
  scrape: ScheduledScrape,
): ScheduledScrapeProgress | null {
  if (scrape.scrape_type === "post_details") {
    const count = getDetailsScrapePostUrls(scrape.state).length;
    return {
      label: `${count} ${count === 1 ? "post" : "posts"} in this batch`,
      percent: scrape.finished_at ? PERCENT_MAX : null,
    };
  }

  if (scrape.scrape_type === "meta") {
    const state = getMetaScrapeState(scrape);
    if (!state) {
      return null;
    }
    return getMetaScrapeProgress(state, scrape.finished_at != null);
  }

  return null;
}

const STATUS_FOCUS_ORDER: ScheduledScrapeStatus[] = ["failed", "running", "queued", "done"];

/** The request most worth looking at first: failures, then in-flight work, then the latest. */
export function pickFocusScheduledScrape(
  scrapes: ScheduledScrape[],
): ScheduledScrape | null {
  for (const status of STATUS_FOCUS_ORDER) {
    const match =
      status === "done"
        ? scrapes.at(-1)
        : scrapes.find((scrape) => getScheduledScrapeStatus(scrape) === status);
    if (match) {
      return match;
    }
  }
  return null;
}

/** Latest transient error for a request, including Meta retries still in flight. */
export function getScheduledScrapeErrorMessage(scrape: ScheduledScrape): string | null {
  if (scrape.error_message) {
    return scrape.error_message;
  }

  return getMetaScrapeState(scrape)?.last_error ?? null;
}

function getMetaScrapeProgress(
  state: MetaScrapeState,
  finished: boolean,
): ScheduledScrapeProgress {
  const insightSteps = getMetaAccountInsightSteps().length;
  const totalSteps = META_PHASES_BEFORE_INSIGHTS + insightSteps;

  if (finished) {
    return { label: "All Meta steps finished", percent: PERCENT_MAX };
  }

  if (state.phase === "media") {
    return {
      label: `${META_PHASE_LABELS.media} · ${state.processed_media_count} imported`,
      percent: 0,
    };
  }

  if (state.phase === "profile") {
    return {
      label: META_PHASE_LABELS.profile,
      percent: Math.round((1 / totalSteps) * PERCENT_MAX),
    };
  }

  const completedSteps = META_PHASES_BEFORE_INSIGHTS + state.account_metric_index;
  return {
    label: `${META_PHASE_LABELS.account_insights} · ${state.account_metric_index}/${insightSteps}`,
    percent: Math.min(
      PERCENT_MAX,
      Math.round((completedSteps / totalSteps) * PERCENT_MAX),
    ),
  };
}

function hasMetaScrapeStarted(scrape: ScheduledScrape): boolean {
  const state = getMetaScrapeState(scrape);
  if (
    state &&
    (state.phase !== "media" ||
      state.processed_media_count > 0 ||
      state.media_cursor != null ||
      state.attempts > 0)
  ) {
    return true;
  }

  return scrape.updated_at > scrape.created_at;
}
