import { handleCallback } from "@vercel/queue";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CLOUDFLARE_QUEUE_DELIVERY_HEADER,
  CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE,
  CLOUDFLARE_QUEUE_RETRY_STATUS,
  META_SCRAPES_QUEUE_SECRET_ENV,
  type CloudflareQueueDelivery,
  type CloudflareQueueRetryResponse,
} from "@/lib/meta/cloudflare-queue-protocol";
import { processMetaScrapeDelivery } from "@/lib/meta/scrape-delivery";
import { getMetaScrapeRetryDelaySeconds } from "@/lib/meta/scrape-retry";
import { hasBearerSecret } from "@/lib/request-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUEUE_VISIBILITY_TIMEOUT_SECONDS = 90;

const CloudflareQueueDeliverySchema = z.object({
  messageId: z.string(),
  attempts: z.number().int().positive(),
  body: z.unknown(),
}) satisfies z.ZodType<CloudflareQueueDelivery>;

/** Vercel Queues callback: the platform verifies the request and retries thrown failures. */
const handleVercelDelivery = handleCallback(
  (message, metadata) =>
    processMetaScrapeDelivery(message, metadata.deliveryCount),
  {
    visibilityTimeoutSeconds: QUEUE_VISIBILITY_TIMEOUT_SECONDS,
    retry: (_error, metadata) => ({
      afterSeconds: getMetaScrapeRetryDelaySeconds(metadata.deliveryCount),
    }),
  },
);

/** Processes one bounded Meta step delivered by either queue transport. */
export async function POST(request: Request) {
  if (
    request.headers.get(CLOUDFLARE_QUEUE_DELIVERY_HEADER) ===
    CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE
  ) {
    return handleCloudflareDelivery(request);
  }

  return handleVercelDelivery(request);
}

/**
 * Cloudflare Queues delivery, posted in-process by the Worker consumer
 * (worker.ts). Authenticated with the shared `META_SCRAPES_QUEUE_SECRET`
 * because the route is otherwise reachable from the public internet.
 */
async function handleCloudflareDelivery(request: Request): Promise<Response> {
  if (!hasBearerSecret(request, process.env[META_SCRAPES_QUEUE_SECRET_ENV])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CloudflareQueueDeliverySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid queue delivery" },
      { status: 400 },
    );
  }

  const { attempts, body, messageId } = parsed.data;
  try {
    await processMetaScrapeDelivery(body, attempts);
  } catch (error) {
    console.error("Meta scrape step failed; asking the queue to redeliver", {
      attempts,
      error,
      messageId,
    });
    const retry: CloudflareQueueRetryResponse = {
      retryAfterSeconds: getMetaScrapeRetryDelaySeconds(attempts),
    };
    return NextResponse.json(retry, { status: CLOUDFLARE_QUEUE_RETRY_STATUS });
  }

  return NextResponse.json({ ok: true });
}
