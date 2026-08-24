import type { IgScrapeJob } from "@/lib/ig/groups";

const IG_SCRAPES_API_PATH = "/api/ig/scrapes";

export interface ScheduleIgScrapeInput {
  igUsername: string;
  requestedPostCount?: number | null;
  sinceWhen?: string | null;
  dataSource?: "public" | "meta_hybrid";
  metaInstagramAccountId?: string | null;
}

interface ScheduleIgScrapeResponse {
  error?: string;
  job?: IgScrapeJob;
}

/**
 * Schedules Instagram listing scrapes through the authenticated server endpoint.
 */
export async function scheduleIgScrape(
  input: ScheduleIgScrapeInput,
): Promise<IgScrapeJob> {
  const response = await fetch(IG_SCRAPES_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      igUsername: input.igUsername,
      requestedPostCount: input.requestedPostCount ?? null,
      sinceWhen: input.sinceWhen ?? null,
      dataSource: input.dataSource ?? "public",
      metaInstagramAccountId: input.metaInstagramAccountId ?? null,
    }),
  });
  const payload = await getResponsePayload(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not schedule scrape");
  }
  if (!payload.job) {
    throw new Error("The server returned an invalid scrape response");
  }

  return payload.job;
}

async function getResponsePayload(response: Response): Promise<ScheduleIgScrapeResponse> {
  const value: unknown = await response.json().catch(() => null);
  if (!isRecord(value)) {
    return {};
  }

  return {
    error: typeof value.error === "string" ? value.error : undefined,
    job: isRecord(value.job) ? (value.job as unknown as IgScrapeJob) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
