import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeMetaScrapeBatch,
  type QueueMessageLike,
} from "@/lib/meta/cloudflare-queue-consumer";
import {
  CLOUDFLARE_QUEUE_DELIVERY_HEADER,
  CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE,
  CLOUDFLARE_QUEUE_RETRY_STATUS,
  META_SCRAPES_QUEUE_PATH,
} from "@/lib/meta/cloudflare-queue-protocol";
import { getMetaScrapeRetryDelaySeconds } from "@/lib/meta/scrape-retry";

const ORIGIN = "https://app.example";
const SECRET = "queue-secret";

function createMessage(attempts = 1): QueueMessageLike {
  return {
    id: `msg-${attempts}`,
    attempts,
    body: { scrapeId: "00000000-0000-4000-8000-000000000000" },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("consumeMetaScrapeBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts an authenticated delivery to the queue route and acks on success", async () => {
    const message = createMessage();
    const fetch = vi.fn(async (_request: Request) =>
      jsonResponse({ ok: true }, 200),
    );

    await consumeMetaScrapeBatch(
      { queue: "meta", messages: [message] },
      { fetch, secret: SECRET, origin: ORIGIN },
    );

    expect(fetch).toHaveBeenCalledOnce();
    const [request] = fetch.mock.calls[0]!;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe(META_SCRAPES_QUEUE_PATH);
    expect(request.headers.get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(request.headers.get(CLOUDFLARE_QUEUE_DELIVERY_HEADER)).toBe(
      CLOUDFLARE_QUEUE_DELIVERY_HEADER_VALUE,
    );
    await expect(request.json()).resolves.toEqual({
      messageId: message.id,
      attempts: 1,
      body: message.body,
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries with the delay the route asks for", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const message = createMessage(3);
    const fetch = vi.fn(async () =>
      jsonResponse({ retryAfterSeconds: 42 }, CLOUDFLARE_QUEUE_RETRY_STATUS),
    );

    await consumeMetaScrapeBatch(
      { queue: "meta", messages: [message] },
      { fetch, secret: SECRET, origin: ORIGIN },
    );

    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 42 });
  });

  it("falls back to exponential backoff when the route gives no delay or throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unauthorized = createMessage(2);
    const crashed = createMessage(4);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
      .mockRejectedValueOnce(new Error("boom"));

    await consumeMetaScrapeBatch(
      { queue: "meta", messages: [unauthorized, crashed] },
      { fetch, secret: SECRET, origin: ORIGIN },
    );

    expect(unauthorized.retry).toHaveBeenCalledWith({
      delaySeconds: getMetaScrapeRetryDelaySeconds(2),
    });
    expect(crashed.retry).toHaveBeenCalledWith({
      delaySeconds: getMetaScrapeRetryDelaySeconds(4),
    });
  });

  it("never calls the route without a configured secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const message = createMessage();
    const fetch = vi.fn();

    await consumeMetaScrapeBatch(
      { queue: "meta", messages: [message] },
      { fetch, secret: undefined, origin: ORIGIN },
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
  });
});
