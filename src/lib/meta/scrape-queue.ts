import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { send } from "@vercel/queue";
import { z } from "zod";

import {
  getMetaScrapeStepKey,
  META_SCRAPE_QUEUE_RETENTION_SECONDS,
  META_SCRAPE_QUEUE_TOPIC,
  type MetaScrapeState,
} from "@/lib/meta/scrape-state";

export interface MetaScrapeQueueMessage {
  scrapeId: string;
}

export const MetaScrapeQueueMessageSchema = z.object({
  scrapeId: z.string().uuid(),
}) satisfies z.ZodType<MetaScrapeQueueMessage>;

/**
 * Structural subset of Cloudflare's `Queue` producer binding (the global
 * `@cloudflare/workers-types` conflict with the DOM lib used by the app).
 */
export interface MetaScrapeQueueProducer {
  send(
    message: MetaScrapeQueueMessage,
    options?: { contentType?: "json"; delaySeconds?: number },
  ): Promise<unknown>;
}

/** Thrown when no transport can deliver to a running consumer. */
export class MetaScrapeQueueUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaScrapeQueueUnavailableError";
  }
}

/**
 * Publishes a durable pointer; all sensitive data and progress stay in Postgres.
 *
 * Transport is picked from the host: the `META_SCRAPES_QUEUE` binding on
 * Cloudflare Workers, otherwise Vercel Queues.
 */
export async function enqueueMetaScrape(
  scrapeId: string,
  state: MetaScrapeState,
): Promise<void> {
  const message: MetaScrapeQueueMessage = { scrapeId };

  const cloudflareQueue = getCloudflareMetaScrapeQueue();
  if (cloudflareQueue) {
    if (process.env.NODE_ENV === "development") {
      // `next dev` exposes the local producer binding but runs no consumer;
      // callers fall back to inline processing. Use `pnpm cf:preview` to
      // exercise the real queue locally.
      throw new MetaScrapeQueueUnavailableError(
        "Cloudflare Queues consumers do not run under `next dev`",
      );
    }
    // Cloudflare Queues have no idempotency keys; a duplicate delivery replays
    // a step that is already replay-safe and guarded by the row's optimistic lock.
    await cloudflareQueue.send(message, { contentType: "json" });
    return;
  }

  await send<MetaScrapeQueueMessage>(META_SCRAPE_QUEUE_TOPIC, message, {
    idempotencyKey: getMetaScrapeStepKey(scrapeId, state),
    retentionSeconds: META_SCRAPE_QUEUE_RETENTION_SECONDS,
  });
}

function getCloudflareMetaScrapeQueue(): MetaScrapeQueueProducer | null {
  try {
    return getCloudflareContext().env.META_SCRAPES_QUEUE ?? null;
  } catch {
    // Not running on Cloudflare (or `next dev` without the OpenNext dev init).
    return null;
  }
}
