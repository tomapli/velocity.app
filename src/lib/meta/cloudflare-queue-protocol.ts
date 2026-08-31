/**
 * Internal HTTP contract between the Cloudflare Worker `queue()` consumer
 * (worker.ts) and the Next.js route that processes Meta scrape steps.
 *
 * The consumer never leaves the Worker: it invokes the OpenNext `fetch`
 * handler in-process, so the route can reuse the Next.js request lifecycle
 * (`after()`, instrumentation) instead of bundling scrape code twice.
 * Free of server-only imports so both sides can import it.
 */

export const META_SCRAPES_QUEUE_PATH = "/api/queues/meta-scrapes";

/** Marks a request as a Cloudflare Queues delivery (vs. a Vercel Queues callback). */
export const CLOUDFLARE_QUEUE_DELIVERY_HEADER = "x-meta-scrapes-delivery";
export const CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE = "cloudflare";

/** Env var / Worker secret holding the bearer token the consumer sends. */
export const META_SCRAPES_QUEUE_SECRET_ENV = "META_SCRAPES_QUEUE_SECRET";

/** Status the route answers with when the step failed and should be redelivered. */
export const CLOUDFLARE_QUEUE_RETRY_STATUS = 503;

/** Request body the consumer posts for each queue message. */
export interface CloudflareQueueDelivery {
  messageId: string;
  /** Delivery attempt number, starting at 1 (Cloudflare `Message.attempts`). */
  attempts: number;
  body: unknown;
}

/** Response body returned with {@link CLOUDFLARE_QUEUE_RETRY_STATUS}. */
export interface CloudflareQueueRetryResponse {
  retryAfterSeconds: number;
}
