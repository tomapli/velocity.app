import { handleCallback } from "@vercel/queue";
import { z } from "zod";

import {
  processMetaScrapeStep,
  recordMetaScrapeFailure,
} from "@/lib/meta/process-scrape";
import { enqueueMetaScrape } from "@/lib/meta/scrape-queue";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const RETRY_BASE_DELAY_SECONDS = 5;
const RETRY_MAX_DELAY_SECONDS = 5 * 60;
const QUEUE_VISIBILITY_TIMEOUT_SECONDS = 90;

const MetaScrapeQueueMessageSchema = z.object({
  scrapeId: z.string().uuid(),
});

/** Processes one bounded Meta step; Vercel retries thrown failures automatically. */
export const POST = handleCallback(
  async (message, metadata) => {
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
        metadata.deliveryCount,
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
  },
  {
    visibilityTimeoutSeconds: QUEUE_VISIBILITY_TIMEOUT_SECONDS,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(
        RETRY_MAX_DELAY_SECONDS,
        RETRY_BASE_DELAY_SECONDS * 2 ** Math.max(0, metadata.deliveryCount - 1),
      ),
    }),
  },
);
