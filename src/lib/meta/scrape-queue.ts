import "server-only";

import { send } from "@vercel/queue";

import {
  getMetaScrapeStepKey,
  META_SCRAPE_QUEUE_RETENTION_SECONDS,
  META_SCRAPE_QUEUE_TOPIC,
  type MetaScrapeState,
} from "@/lib/meta/scrape-state";

export interface MetaScrapeQueueMessage {
  scrapeId: string;
}

/** Publishes a durable pointer; all sensitive data and progress stay in Postgres. */
export async function enqueueMetaScrape(
  scrapeId: string,
  state: MetaScrapeState,
): Promise<void> {
  await send<MetaScrapeQueueMessage>(
    META_SCRAPE_QUEUE_TOPIC,
    { scrapeId },
    {
      idempotencyKey: getMetaScrapeStepKey(scrapeId, state),
      retentionSeconds: META_SCRAPE_QUEUE_RETENTION_SECONDS,
    },
  );
}
