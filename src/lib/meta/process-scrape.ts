import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage } from "@/lib/errors";
import { listMetaMediaPage } from "@/lib/meta/api";
import { loadStoredMetaAccountAccess } from "@/lib/meta/connections";
import { getMetaAccountInsightSteps } from "@/lib/meta/insights";
import {
  importMetaAccountInsightMetric,
  importMetaMediaBatch,
  importMetaProfile,
  type MetaScrapeContext,
} from "@/lib/meta/scrape";
import {
  META_SCRAPE_MAX_DELIVERY_COUNT,
  META_SCRAPE_MEDIA_BATCH_SIZE,
  MetaScrapeStateSchema,
  parseMetaScrapeState,
  toMetaScrapeStateJson,
  type MetaScrapeState,
} from "@/lib/meta/scrape-state";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

type AdminClient = SupabaseClient<Database>;
type Group = Tables<"groups">;
type ScheduledScrape = Tables<"scheduled_scrapes">;

export interface MetaScrapeStepResult {
  completed: boolean;
  state: MetaScrapeState;
}

interface LoadedMetaScrape {
  context: MetaScrapeContext;
  group: Group;
  scrape: ScheduledScrape;
  state: MetaScrapeState;
}

/** Runs exactly one bounded, replay-safe step from database state. */
export async function processMetaScrapeStep(
  admin: AdminClient,
  scrapeId: string,
): Promise<MetaScrapeStepResult | null> {
  const loaded = await loadMetaScrape(admin, scrapeId);
  if (!loaded || loaded.scrape.finished_at) {
    return null;
  }

  if (loaded.state.phase === "media") {
    return processMediaStep(admin, loaded);
  }
  if (loaded.state.phase === "profile") {
    await importMetaProfile({
      ...loaded.context,
      periodEnd: loaded.state.period_end,
    });
    const state = clearRetryState({
      ...loaded.state,
      phase: "account_insights",
      account_metric_index: 0,
    });
    const persisted = await persistState(admin, scrapeId, state, false);
    return { completed: !persisted, state };
  }

  return processAccountInsightStep(admin, loaded);
}

/** Records transient delivery state and makes exhausted retries visible in history. */
export async function recordMetaScrapeFailure(
  admin: AdminClient,
  scrapeId: string,
  deliveryCount: number,
  error: unknown,
): Promise<boolean> {
  const message = getErrorMessage(error, "Meta scrape step failed");
  const { data: scrape, error: queryError } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("id", scrapeId)
    .eq("scrape_type", "meta")
    .maybeSingle();
  if (queryError) {
    throw queryError;
  }
  if (!scrape || scrape.finished_at) {
    return true;
  }

  const parsed = MetaScrapeStateSchema.safeParse(scrape.state);
  const exhausted =
    !parsed.success || deliveryCount >= META_SCRAPE_MAX_DELIVERY_COUNT;
  const now = new Date().toISOString();
  const update = parsed.success
    ? {
        state: toMetaScrapeStateJson({
          ...parsed.data,
          attempts: deliveryCount,
          last_error: message,
        }),
        error_message: exhausted ? message : null,
        finished_at: exhausted ? now : null,
        updated_at: now,
      }
    : {
        error_message: message,
        finished_at: now,
        updated_at: now,
      };
  const { error: updateError } = await admin
    .from("scheduled_scrapes")
    .update(update)
    .eq("id", scrapeId)
    .is("finished_at", null);
  if (updateError) {
    throw updateError;
  }
  return exhausted;
}

async function processMediaStep(
  admin: AdminClient,
  loaded: LoadedMetaScrape,
): Promise<MetaScrapeStepResult> {
  const requestedCount = loaded.group.requested_post_count;
  const remaining =
    requestedCount == null
      ? META_SCRAPE_MEDIA_BATCH_SIZE
      : requestedCount - loaded.state.processed_media_count;

  if (remaining <= 0) {
    const state = clearRetryState({ ...loaded.state, phase: "profile" });
    const persisted = await persistState(admin, loaded.scrape.id, state, false);
    return { completed: !persisted, state };
  }

  const page = await listMetaMediaPage({
    provider: loaded.context.access.connection.provider,
    igUserId: loaded.context.access.account.ig_user_id,
    token: loaded.context.access.token,
    sinceWhen: loaded.group.since_when,
    cursor: loaded.state.media_cursor,
    limit: Math.min(META_SCRAPE_MEDIA_BATCH_SIZE, remaining),
  });
  if (page.items.length > 0) {
    await importMetaMediaBatch(loaded.context, page.items);
  }

  const processedMediaCount =
    loaded.state.processed_media_count + page.items.length;
  const reachedRequestedCount =
    requestedCount != null && processedMediaCount >= requestedCount;
  const hasNextPage = page.nextCursor != null && !reachedRequestedCount;
  const state = clearRetryState({
    ...loaded.state,
    phase: hasNextPage ? "media" : "profile",
    media_cursor: hasNextPage ? page.nextCursor : null,
    processed_media_count: processedMediaCount,
  });
  const persisted = await persistState(admin, loaded.scrape.id, state, false);
  return { completed: !persisted, state };
}

async function processAccountInsightStep(
  admin: AdminClient,
  loaded: LoadedMetaScrape,
): Promise<MetaScrapeStepResult> {
  const steps = getMetaAccountInsightSteps();
  const step = steps[loaded.state.account_metric_index];
  if (!step) {
    const state = clearRetryState(loaded.state);
    await persistState(admin, loaded.scrape.id, state, true);
    return { completed: true, state };
  }

  await importMetaAccountInsightMetric({
    ...loaded.context,
    metric: step.metric,
    rangeDays: step.rangeDays,
    periodEnd: loaded.state.period_end,
  });
  const nextMetricIndex = loaded.state.account_metric_index + 1;
  const completed = nextMetricIndex >= steps.length;
  const state = clearRetryState({
    ...loaded.state,
    account_metric_index: nextMetricIndex,
  });
  const persisted = await persistState(
    admin,
    loaded.scrape.id,
    state,
    completed,
  );
  return { completed: completed || !persisted, state };
}

async function loadMetaScrape(
  admin: AdminClient,
  scrapeId: string,
): Promise<LoadedMetaScrape | null> {
  const { data: scrape, error: scrapeError } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("id", scrapeId)
    .eq("scrape_type", "meta")
    .maybeSingle();
  if (scrapeError) {
    throw scrapeError;
  }
  if (!scrape) {
    return null;
  }

  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("*")
    .eq("id", scrape.group_id)
    .single();
  if (groupError) {
    throw groupError;
  }
  if (!group.meta_instagram_account_id) {
    throw new Error("Meta scrape group has no Instagram account");
  }

  const [{ data: profile, error: profileError }, listingResult, access] =
    await Promise.all([
      admin.from("ig_profiles").select("*").eq("id", group.ig_profile_id).single(),
      admin
        .from("scheduled_scrapes")
        .select("*")
        .eq("group_id", group.id)
        .in("scrape_type", ["posts", "reels"]),
      loadStoredMetaAccountAccess(admin, group.meta_instagram_account_id),
    ]);
  if (profileError) {
    throw profileError;
  }
  if (listingResult.error) {
    throw listingResult.error;
  }

  return {
    scrape,
    group,
    state: parseMetaScrapeState(scrape.state),
    context: {
      admin,
      access,
      groupId: group.id,
      profileId: profile.id,
      listingScrapes: listingResult.data ?? [],
    },
  };
}

async function persistState(
  admin: AdminClient,
  scrapeId: string,
  state: MetaScrapeState,
  completed: boolean,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("scheduled_scrapes")
    .update({
      state: toMetaScrapeStateJson(state),
      error_message: null,
      finished_at: completed ? now : null,
      updated_at: now,
    })
    .eq("id", scrapeId)
    .eq("scrape_type", "meta")
    .is("finished_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data != null;
}

function clearRetryState(state: MetaScrapeState): MetaScrapeState {
  return { ...state, attempts: 0, last_error: null };
}
