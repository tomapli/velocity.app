import { z } from "zod";

import { META_ACCOUNT_INSIGHTS_DAYS } from "@/lib/meta/constants";
import type { Json } from "@/lib/supabase/database.types";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1_000;

export const META_SCRAPE_QUEUE_TOPIC = "meta-scrapes";
export const META_SCRAPE_MEDIA_BATCH_SIZE = 5;
export const META_SCRAPE_MAX_DELIVERY_COUNT = 8;
export const META_SCRAPE_QUEUE_RETENTION_SECONDS = 7 * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;

export const MetaScrapeStateSchema = z.object({
  version: z.literal(1),
  phase: z.enum(["media", "profile", "account_insights"]),
  media_cursor: z.string().nullable(),
  processed_media_count: z.number().int().nonnegative(),
  account_metric_index: z.number().int().nonnegative(),
  period_start: z.string().datetime({ offset: true }),
  period_end: z.string().datetime({ offset: true }),
  attempts: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
});

export type MetaScrapeState = z.infer<typeof MetaScrapeStateSchema>;

/** Creates the durable starting point for a bounded Meta scrape pipeline. */
export function createInitialMetaScrapeState(now = new Date()): MetaScrapeState {
  const periodEnd = new Date(now);
  const periodStart = new Date(
    periodEnd.getTime() -
      META_ACCOUNT_INSIGHTS_DAYS *
        HOURS_PER_DAY *
        MINUTES_PER_HOUR *
        SECONDS_PER_MINUTE *
        MILLISECONDS_PER_SECOND,
  );

  return {
    version: 1,
    phase: "media",
    media_cursor: null,
    processed_media_count: 0,
    account_metric_index: 0,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    attempts: 0,
    last_error: null,
  };
}

/** Parses persisted state instead of trusting arbitrary JSON from the database. */
export function parseMetaScrapeState(value: Json): MetaScrapeState {
  return MetaScrapeStateSchema.parse(value);
}

/** Converts validated state into the generated Supabase JSON value. */
export function toMetaScrapeStateJson(state: MetaScrapeState): Json {
  return JSON.parse(JSON.stringify(state)) as Json;
}

/** Stable queue key prevents duplicate publications for the same durable step. */
export function getMetaScrapeStepKey(
  scrapeId: string,
  state: MetaScrapeState,
): string {
  if (state.phase === "media") {
    return `${scrapeId}:media:${state.media_cursor ?? "first"}`;
  }
  if (state.phase === "account_insights") {
    return `${scrapeId}:account:${state.account_metric_index}`;
  }
  return `${scrapeId}:${state.phase}`;
}
