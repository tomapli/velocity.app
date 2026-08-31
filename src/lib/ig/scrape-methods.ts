import type { Database } from "@/lib/supabase/database.types";

/** Which Apify pipeline collects the public post data of a scrape (group). */
export type IgScrapeMethod = Database["public"]["Enums"]["ig_scrape_method"];

export const IG_SCRAPE_METHOD = {
  APIFY_INSTAGRAM_SCRAPER: "apify_instagram_scraper",
  DATA_SLAYER_INSTAGRAM_POSTS: "data_slayer_instagram_posts",
} as const satisfies Record<string, IgScrapeMethod>;

export const IG_SCRAPE_METHODS = [
  IG_SCRAPE_METHOD.APIFY_INSTAGRAM_SCRAPER,
  IG_SCRAPE_METHOD.DATA_SLAYER_INSTAGRAM_POSTS,
] as const satisfies readonly IgScrapeMethod[];

export const IG_DEFAULT_SCRAPE_METHOD: IgScrapeMethod =
  IG_SCRAPE_METHOD.APIFY_INSTAGRAM_SCRAPER;

export const IG_SCRAPE_METHOD_LABELS: Record<IgScrapeMethod, string> = {
  apify_instagram_scraper: "Listing + post details",
  data_slayer_instagram_posts: "Profile posts",
};

/** The Apify actors behind each method, for badges and tooltips. */
export const IG_SCRAPE_METHOD_ACTOR_LABELS: Record<IgScrapeMethod, string> = {
  apify_instagram_scraper:
    "apify/instagram-scraper + data-slayer/instagram-post-details",
  data_slayer_instagram_posts: "data-slayer/instagram-posts",
};

export const IG_SCRAPE_METHOD_DESCRIPTIONS: Record<IgScrapeMethod, string> = {
  apify_instagram_scraper:
    "Lists posts and reels first, then enriches them with detailed metrics in batches of 100. Slower, but the start date is applied while scraping.",
  data_slayer_instagram_posts:
    "Downloads the profile feed with metrics in a single run. Faster and simpler; a start date is applied after the download.",
};

/** Request types that download the profile's post list. */
const LISTING_SCRAPE_TYPES = new Set<
  Database["public"]["Enums"]["scheduled_scrape_type"]
>(["posts", "reels", "profile_posts"]);

export function isListingScrapeType(
  scrapeType: Database["public"]["Enums"]["scheduled_scrape_type"],
): boolean {
  return LISTING_SCRAPE_TYPES.has(scrapeType);
}

/** Number of listing requests a scrape starts with for the given method. */
export function getExpectedListingRequestCount(method: IgScrapeMethod): number {
  return method === IG_SCRAPE_METHOD.DATA_SLAYER_INSTAGRAM_POSTS ? 1 : 2;
}

/** Whether the method enriches listed posts through separate post-details batches. */
export function usesPostDetailsBatches(method: IgScrapeMethod): boolean {
  return method === IG_SCRAPE_METHOD.APIFY_INSTAGRAM_SCRAPER;
}
