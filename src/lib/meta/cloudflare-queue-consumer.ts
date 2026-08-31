import {
  CLOUDFLARE_QUEUE_DELIVERY_HEADER,
  CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE,
  META_SCRAPES_QUEUE_PATH,
  type CloudflareQueueDelivery,
  type CloudflareQueueRetryResponse,
} from "@/lib/meta/cloudflare-queue-protocol";
import { getMetaScrapeRetryDelaySeconds } from "@/lib/meta/scrape-retry";

/** Structural subset of Cloudflare's `Message` so tests need no Workers types. */
export interface QueueMessageLike<Body = unknown> {
  id: string;
  attempts: number;
  body: Body;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

/** Structural subset of Cloudflare's `MessageBatch`. */
export interface QueueBatchLike<Body = unknown> {
  queue: string;
  messages: readonly QueueMessageLike<Body>[];
}

export interface MetaScrapeQueueConsumerOptions {
  /** Invokes the app's fetch handler (in-process on Workers). */
  fetch: (request: Request) => Promise<Response>;
  /** Value of the `META_SCRAPES_QUEUE_SECRET` Worker secret. */
  secret: string | undefined;
  /** Origin used to build the absolute route URL; only its path is routed. */
  origin: string;
}

/**
 * Hands each queued Meta scrape step to the Next.js route and translates the
 * HTTP outcome into Cloudflare Queues ack/retry calls. Messages are processed
 * sequentially: each step is short and its successor is enqueued by the route.
 */
export async function consumeMetaScrapeBatch(
  batch: QueueBatchLike,
  options: MetaScrapeQueueConsumerOptions,
): Promise<void> {
  for (const message of batch.messages) {
    await deliverMetaScrapeMessage(message, options);
  }
}

async function deliverMetaScrapeMessage(
  message: QueueMessageLike,
  options: MetaScrapeQueueConsumerOptions,
): Promise<void> {
  const fallbackDelaySeconds = getMetaScrapeRetryDelaySeconds(message.attempts);
  const logContext = { messageId: message.id, attempts: message.attempts };

  if (!options.secret) {
    console.error(
      "META_SCRAPES_QUEUE_SECRET is not set; Meta scrape message will be retried",
      logContext,
    );
    message.retry({ delaySeconds: fallbackDelaySeconds });
    return;
  }

  const delivery: CloudflareQueueDelivery = {
    messageId: message.id,
    attempts: message.attempts,
    body: message.body,
  };

  let response: Response;
  try {
    response = await options.fetch(
      new Request(new URL(META_SCRAPES_QUEUE_PATH, options.origin), {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.secret}`,
          "content-type": "application/json",
          [CLOUDFLARE_QUEUE_DELIVERY_HEADER]: CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE,
        },
        body: JSON.stringify(delivery),
      }),
    );
  } catch (error) {
    console.error("Meta scrape delivery threw", { ...logContext, error });
    message.retry({ delaySeconds: fallbackDelaySeconds });
    return;
  }

  if (response.ok) {
    message.ack();
    return;
  }

  const retryAfterSeconds =
    (await readRetryAfterSeconds(response)) ?? fallbackDelaySeconds;
  console.error("Meta scrape delivery failed", {
    ...logContext,
    status: response.status,
    retryAfterSeconds,
  });
  message.retry({ delaySeconds: retryAfterSeconds });
}

async function readRetryAfterSeconds(
  response: Response,
): Promise<number | null> {
  const payload = (await response.json().catch(() => null)) as
    | Partial<CloudflareQueueRetryResponse>
    | null;
  const seconds = payload?.retryAfterSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : null;
}
