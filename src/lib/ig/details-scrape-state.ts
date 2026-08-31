import type { ScheduledScrape } from "@/lib/ig/queries";

/** `scheduled_scrapes.state` key holding the post URLs sent in one details batch. */
export const DETAILS_SCRAPE_STATE_POST_URLS_KEY = "postUrls";

/** Reads the post URLs a post-details request was created for. */
export function getDetailsScrapePostUrls(state: ScheduledScrape["state"]): string[] {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [];
  }

  const postUrls = state[DETAILS_SCRAPE_STATE_POST_URLS_KEY];
  return Array.isArray(postUrls)
    ? postUrls.filter((postUrl): postUrl is string => typeof postUrl === "string")
    : [];
}
