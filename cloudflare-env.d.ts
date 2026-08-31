import type { MetaScrapeQueueProducer } from "@/lib/meta/scrape-queue";

/**
 * Bindings declared in wrangler.jsonc, merged into the `CloudflareEnv`
 * interface that `@opennextjs/cloudflare` exposes via `getCloudflareContext()`.
 *
 * Kept by hand (`wrangler types` would overwrite it) and typed structurally:
 * the global `@cloudflare/workers-types` declarations conflict with the DOM
 * lib this Next.js app compiles against.
 */
declare global {
  interface CloudflareEnv {
    /** Producer binding for the Meta scrape pipeline. */
    META_SCRAPES_QUEUE?: MetaScrapeQueueProducer;
    /** Shared secret between the queue consumer and the Next.js route. */
    META_SCRAPES_QUEUE_SECRET?: string;
    /** Public origin of the deployment. */
    APP_URL?: string;
  }
}

export {};
