import "server-only";

import {
  processMetaScrapeStep,
  recordMetaScrapeFailure,
} from "@/lib/meta/process-scrape";
import {
  enqueueMetaScrape,
  MetaScrapeQueueMessageSchema,
} from "@/lib/meta/scrape-queue";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Processes one queued Meta scrape step regardless of transport.
 *
 * Resolves when the message can be acknowledged (step done, or retries
 * exhausted and recorded). Throws the step error when the transport should
 * redeliver; `deliveryCount` starts at 1 for the first delivery.
 */
export async function processMetaScrapeDelivery(
  message: unknown,
  deliveryCount: number,
): Promise<void> {
  const { scrapeId } = MetaScrapeQueueMessageSchema.parse(message);
  const admin = createAdminClient();

  try {
    const result = await processMetaScrapeStep(admin, scrapeId);
    if (result && !result.completed) {
      await enqueueMetaScrape(scrapeId, result.state);
    }
  } catch (error) {
    const exhausted = await recordMetaScrapeFailure(
      admin,
      scrapeId,
      deliveryCount,
      error,
    );
    if (!exhausted) {
      throw error;
    }
    console.error("Meta scrape exhausted its queue retries", {
      error,
      scrapeId,
    });
  }
}
