/**
 * Retry policy shared by every Meta scrape queue transport (Vercel Queues on
 * Vercel, Cloudflare Queues on Workers). Kept free of server-only imports so
 * the Cloudflare Worker entry can bundle it.
 */

export const META_SCRAPE_RETRY_BASE_DELAY_SECONDS = 5;
export const META_SCRAPE_RETRY_MAX_DELAY_SECONDS = 5 * 60;

/** Exponential backoff for a failed delivery; `deliveryCount` starts at 1. */
export function getMetaScrapeRetryDelaySeconds(deliveryCount: number): number {
  return Math.min(
    META_SCRAPE_RETRY_MAX_DELAY_SECONDS,
    META_SCRAPE_RETRY_BASE_DELAY_SECONDS * 2 ** Math.max(0, deliveryCount - 1),
  );
}
