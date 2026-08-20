import { z } from "zod";

export const APIFY_API_BASE_URL = "https://api.apify.com/v2";
export const APIFY_DATASET_PAGE_SIZE = 1_000;
export const APIFY_INSTAGRAM_SCRAPER_ACTOR_ID = "apify~instagram-scraper";
export const APIFY_INSTAGRAM_POST_DETAILS_ACTOR_ID =
  "data-slayer~instagram-post-details";
export const APIFY_DETAILS_BATCH_SIZE = 100;

export interface ApifyActorRun {
  id: string;
  defaultDatasetId: string;
  status?: string;
}

export interface ApifyWebhookPayload {
  eventType?: string;
  eventData?: ApifyWebhookRun;
  resource?: ApifyWebhookRun;
}

export interface ApifyWebhookRun {
  actorRunId?: string;
  defaultDatasetId?: string;
  id?: string;
  status?: string;
  statusMessage?: string;
}

export interface StartActorRunOptions {
  webhookUrl?: string | null;
  webhookSecret?: string | null;
}

/**
 * Starts an Apify actor run and optionally attaches the app webhook.
 */
export async function startActorRun(
  token: string,
  actorId: string,
  input: unknown,
  options: StartActorRunOptions = {},
): Promise<ApifyActorRun> {
  const runUrl = new URL(`${APIFY_API_BASE_URL}/acts/${actorId}/runs`);
  const webhook = getWebhookConfig(options);
  if (webhook) {
    runUrl.searchParams.set("webhooks", Buffer.from(JSON.stringify([webhook])).toString("base64"));
  }

  const response = await fetch(runUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const responseBody = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(getApifyErrorMessage(responseBody, response.status));
  }

  return parseActorRun(responseBody);
}

export async function getActorRun(
  token: string,
  runId: string,
): Promise<ApifyActorRun> {
  const response = await fetch(`${APIFY_API_BASE_URL}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const responseBody = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(getApifyErrorMessage(responseBody, response.status));
  }

  return parseActorRun(responseBody);
}

export async function getDatasetItems(
  token: string,
  datasetId: string,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let offset = 0;

  while (true) {
    const datasetUrl = new URL(`${APIFY_API_BASE_URL}/datasets/${datasetId}/items`);
    datasetUrl.searchParams.set("clean", "true");
    datasetUrl.searchParams.set("format", "json");
    datasetUrl.searchParams.set("limit", String(APIFY_DATASET_PAGE_SIZE));
    datasetUrl.searchParams.set("offset", String(offset));

    const response = await fetch(datasetUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const responseBody = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(getApifyErrorMessage(responseBody, response.status));
    }
    if (!Array.isArray(responseBody)) {
      throw new Error("Apify returned an invalid dataset response");
    }

    items.push(...responseBody);
    if (responseBody.length < APIFY_DATASET_PAGE_SIZE) {
      return items;
    }

    offset += responseBody.length;
  }
}

export function getApifyWebhookUrl(): string | null {
  if (process.env.APIFY_WEBHOOK_URL) {
    return process.env.APIFY_WEBHOOK_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/webhooks/apify/ig-scrapes`;
  }

  return null;
}

function getWebhookConfig(options: StartActorRunOptions): Record<string, unknown> | null {
  const requestUrl = options.webhookUrl ?? getApifyWebhookUrl();
  const secret = options.webhookSecret ?? process.env.APIFY_WEBHOOK_SECRET;
  if (!requestUrl || !secret) {
    return null;
  }

  return {
    eventTypes: [
      "ACTOR.RUN.SUCCEEDED",
      "ACTOR.RUN.FAILED",
      "ACTOR.RUN.ABORTED",
      "ACTOR.RUN.TIMED_OUT",
    ],
    requestUrl,
    headersTemplate: JSON.stringify({ Authorization: `Bearer ${secret}` }),
  };
}

function getApifyErrorMessage(responseBody: unknown, status: number): string {
  const parsed = z
    .object({ error: z.object({ message: z.string() }).optional() })
    .safeParse(responseBody);
  return parsed.success && parsed.data.error?.message
    ? parsed.data.error.message
    : `Apify request failed with status ${status}`;
}

function parseActorRun(responseBody: unknown): ApifyActorRun {
  const parsed = z
    .object({
      data: z.object({
        id: z.string(),
        defaultDatasetId: z.string(),
        status: z.string().optional(),
      }),
    })
    .safeParse(responseBody);
  if (!parsed.success) {
    throw new Error("Apify returned an invalid actor run response");
  }

  return parsed.data.data;
}
