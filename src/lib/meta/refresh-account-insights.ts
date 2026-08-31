import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  META_ACCOUNT_INSIGHTS_REFRESH_TTL_MS,
  META_ACCOUNT_INSIGHTS_STUCK_RUN_MS,
} from "@/lib/meta/constants";
import {
  processMetaScrapeStep,
  recordMetaScrapeFailure,
} from "@/lib/meta/process-scrape";
import { enqueueMetaScrape } from "@/lib/meta/scrape-queue";
import {
  createMetaInsightsRefreshState,
  META_SCRAPE_MAX_DELIVERY_COUNT,
  toMetaScrapeStateJson,
  type MetaScrapeState,
} from "@/lib/meta/scrape-state";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

type AdminClient = SupabaseClient<Database>;
type Group = Tables<"groups">;

// Generous bound on profile + range×metric steps for the inline dev fallback.
const INLINE_MAX_STEPS = 100;

/**
 * Re-runs the profile + account-insights phases of a group's Meta scrape when
 * its profile page is opened. Skips public groups, in-flight runs, and runs
 * fresher than the TTL; an optimistic lock keeps concurrent opens from
 * double-starting. Unfinished runs whose row has gone quiet (a lost queue
 * message, a failed enqueue) are reclaimed after a grace period.
 */
export async function maybeScheduleMetaInsightsRefresh(
  admin: AdminClient,
  group: Group,
  now = new Date(),
): Promise<boolean> {
  if (group.data_source !== "meta_hybrid" || !group.meta_instagram_account_id) {
    return false;
  }

  const { data: scrape, error: scrapeError } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("group_id", group.id)
    .eq("scrape_type", "meta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scrapeError) {
    throw scrapeError;
  }

  if (!scrape) {
    // Meta-hybrid groups created before durable meta scrapes have no row yet.
    const state = createMetaInsightsRefreshState(now);
    const { data: created, error: insertError } = await admin
      .from("scheduled_scrapes")
      .insert({
        group_id: group.id,
        scrape_type: "meta",
        state: toMetaScrapeStateJson(state),
      })
      .select("id")
      .single();
    if (insertError) {
      throw insertError;
    }
    await startMetaScrapeRun(admin, created.id, state);
    return true;
  }

  if (scrape.finished_at) {
    const finishedAt = Date.parse(scrape.finished_at);
    if (
      Number.isFinite(finishedAt) &&
      now.getTime() - finishedAt < META_ACCOUNT_INSIGHTS_REFRESH_TTL_MS
    ) {
      return false;
    }
  } else {
    const updatedAt = Date.parse(scrape.updated_at);
    const abandoned =
      !Number.isFinite(updatedAt) ||
      now.getTime() - updatedAt > META_ACCOUNT_INSIGHTS_STUCK_RUN_MS;
    if (!abandoned) {
      return false;
    }
  }

  const state = createMetaInsightsRefreshState(now);
  const { data: claimed, error: updateError } = await admin
    .from("scheduled_scrapes")
    .update({
      state: toMetaScrapeStateJson(state),
      error_message: null,
      finished_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", scrape.id)
    .eq("updated_at", scrape.updated_at)
    .select("id")
    .maybeSingle();
  if (updateError) {
    throw updateError;
  }
  if (!claimed) {
    return false;
  }

  await startMetaScrapeRun(admin, scrape.id, state);
  return true;
}

/**
 * Publishes the first queue step. Local dev without Vercel queue credentials
 * (`vercel env pull`) cannot publish, so there the run is processed inline
 * instead of leaving a claimed row behind with no worker.
 */
async function startMetaScrapeRun(
  admin: AdminClient,
  scrapeId: string,
  state: MetaScrapeState,
): Promise<void> {
  try {
    await enqueueMetaScrape(scrapeId, state);
  } catch (error) {
    if (process.env.NODE_ENV !== "development") {
      throw error;
    }
    console.warn(
      "Meta queue unavailable in dev (`vercel env pull` for Vercel Queues, `pnpm cf:preview` for Cloudflare Queues); processing the scrape inline",
      error,
    );
    after(() => runMetaScrapeInline(admin, scrapeId));
  }
}

async function runMetaScrapeInline(
  admin: AdminClient,
  scrapeId: string,
): Promise<void> {
  try {
    for (let step = 0; step < INLINE_MAX_STEPS; step += 1) {
      const result = await processMetaScrapeStep(admin, scrapeId);
      if (!result || result.completed) {
        return;
      }
    }
    throw new Error("Inline Meta scrape exceeded its step budget");
  } catch (error) {
    console.error("Inline Meta scrape failed", { error, scrapeId });
    await recordMetaScrapeFailure(
      admin,
      scrapeId,
      META_SCRAPE_MAX_DELIVERY_COUNT,
      error,
    ).catch(() => undefined);
  }
}
