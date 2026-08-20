import type { SupabaseClient } from "@supabase/supabase-js";

import { getActorRun, getDatasetItems } from "@/lib/apify/client";
import {
  getInstagramShortcode,
  mapInstagramListingItem,
  mapInstagramListingProfile,
  toPendingIgPost,
} from "@/lib/apify/instagram-listing";
import {
  mapInstagramDetailsProfile,
  mapInstagramPostDetails,
} from "@/lib/apify/instagram-post-details";
import {
  listingScrapesAreSettled,
  shouldContinueDetails,
  startDetailsBatchForGroup,
} from "@/lib/ig/start-runs";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

const APIFY_SUCCESS_STATUS = "SUCCEEDED";
const APIFY_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "TIMED-OUT"]);
const UPSERT_BATCH_SIZE = 100;

type AdminClient = SupabaseClient<Database>;
type ScheduledScrape = Tables<"scheduled_scrapes">;

/**
 * Imports a succeeded Apify run for a scheduled scrape row.
 */
export async function processSucceededApifyRun(
  admin: AdminClient,
  scrape: ScheduledScrape,
  token: string,
  datasetId?: string | null,
): Promise<{ importedPostCount?: number; batchHadOlderPost?: boolean }> {
  const actorRun = datasetId ? null : await getActorRun(token, scrape.apify_run_id!);
  const dataset = await getDatasetItems(
    token,
    datasetId ?? actorRun!.defaultDatasetId,
  );

  if (scrape.scrape_type === "post_details") {
    const imported = await importDetails(admin, scrape, dataset);
    await finishScrape(admin, scrape.id);

    return {
      importedPostCount: imported.updatedCount,
      batchHadOlderPost: imported.batchHadOlderPost,
    };
  }

  await importListing(admin, scrape, dataset);
  await finishScrape(admin, scrape.id);

  return {};
}

/**
 * Polls Apify for runs that finished without a webhook callback.
 */
export async function syncUnsettledApifyRunsForGroup(
  admin: AdminClient,
  token: string,
  groupId: string,
): Promise<number> {
  const { data: scrapes, error } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("group_id", groupId)
    .is("finished_at", null)
    .not("apify_run_id", "is", null);

  if (error) {
    throw error;
  }

  let syncedCount = 0;
  const affectedGroupIds = new Set<string>();

  for (const scrape of scrapes ?? []) {
    const actorRun = await getActorRun(token, scrape.apify_run_id!);
    if (actorRun.status === APIFY_SUCCESS_STATUS) {
      await processSucceededApifyRun(admin, scrape, token, actorRun.defaultDatasetId);
      affectedGroupIds.add(scrape.group_id);
      syncedCount += 1;
      continue;
    }

    if (APIFY_FAILED_STATUSES.has(actorRun.status ?? "")) {
      await markScrapeFailed(
        admin,
        scrape.id,
        `Apify run ${actorRun.status?.toLowerCase() ?? "failed"}`,
      );
      affectedGroupIds.add(scrape.group_id);
      syncedCount += 1;
    }
  }

  for (const groupId of affectedGroupIds) {
    await maybeStartDetails(admin, token, groupId);
  }

  return syncedCount;
}

/**
 * Attempts to start or continue the post-details pipeline for a scrape group.
 */
export async function advanceApifyGroupPipeline(
  admin: AdminClient,
  token: string,
  groupId: string,
  scrape?: ScheduledScrape,
  batchHadOlderPost = false,
): Promise<{ startedDetails?: boolean; continued?: boolean }> {
  if (scrape?.scrape_type === "post_details") {
    const continued = await maybeContinueDetails(admin, token, scrape, batchHadOlderPost);
    return { continued };
  }

  const startedDetails = await maybeStartDetails(admin, token, groupId);
  return { startedDetails };
}
/**
 * Marks a scheduled scrape as failed and attempts to advance the group pipeline.
 */
export async function markScrapeFailedAndAdvance(
  admin: AdminClient,
  scrape: ScheduledScrape,
  message: string,
): Promise<void> {
  await markScrapeFailed(admin, scrape.id, message);
  const token = process.env.APIFY_API_TOKEN;
  if (token && (scrape.scrape_type === "posts" || scrape.scrape_type === "reels")) {
    await maybeStartDetails(admin, token, scrape.group_id);
  }
}

async function importListing(
  admin: AdminClient,
  scrape: ScheduledScrape,
  dataset: unknown[],
): Promise<void> {
  const items = dataset
    .map((item) => mapInstagramListingItem(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const sinceTimestamp = scrape.since_when ? Date.parse(scrape.since_when) : null;
  const pending = items
    .filter((item) => {
      if (!sinceTimestamp || !item.uploadedAt) {
        return true;
      }

      const uploadedAt = Date.parse(item.uploadedAt);
      return !Number.isFinite(uploadedAt) || uploadedAt >= sinceTimestamp;
    })
    .map((item) => toPendingIgPost(scrape.ig_profile_id, scrape.id, item));

  for (let index = 0; index < pending.length; index += UPSERT_BATCH_SIZE) {
    const { error } = await admin.from("ig_posts").upsert(
      pending.slice(index, index + UPSERT_BATCH_SIZE),
      {
        onConflict: "ig_profile_id,post_url",
        ignoreDuplicates: true,
      },
    );
    if (error) {
      throw error;
    }
  }

  const profileUpdate = dataset
    .map((item) => mapInstagramListingProfile(item))
    .find((value) => Object.values(value).some((entry) => entry != null));
  if (profileUpdate) {
    const { error } = await admin
      .from("ig_profiles")
      .update(profileUpdate)
      .eq("id", scrape.ig_profile_id);
    if (error) {
      throw error;
    }
  }
}

async function importDetails(
  admin: AdminClient,
  scrape: ScheduledScrape,
  dataset: unknown[],
): Promise<{ updatedCount: number; batchHadOlderPost: boolean }> {
  const { data: existing, error: existingError } = await admin
    .from("ig_posts")
    .select("id, post_url")
    .eq("ig_profile_id", scrape.ig_profile_id);

  if (existingError) {
    throw existingError;
  }

  const byShortcode = new Map(
    (existing ?? [])
      .map((post) => [getInstagramShortcode(post.post_url), post.id] as const)
      .filter((entry): entry is readonly [string, string] => entry[0] != null),
  );

  const sinceTimestamp = scrape.since_when ? Date.parse(scrape.since_when) : null;
  let updatedCount = 0;
  let batchHadOlderPost = false;

  for (const item of dataset) {
    const details = mapInstagramPostDetails(item);
    if (!details) {
      continue;
    }

    const shortcode = getInstagramShortcode(details.post_url);
    const postId = shortcode ? byShortcode.get(shortcode) : undefined;
    if (!postId) {
      continue;
    }

    const uploadedAt = Date.parse(details.uploaded_at);
    if (sinceTimestamp && Number.isFinite(uploadedAt) && uploadedAt < sinceTimestamp) {
      batchHadOlderPost = true;
      continue;
    }

    const { error } = await admin
      .from("ig_posts")
      .update({
        ...details,
        details_scrape_id: scrape.id,
      })
      .eq("id", postId);
    if (error) {
      throw error;
    }

    updatedCount += 1;
  }

  const profileUpdate = dataset
    .map((item) => mapInstagramDetailsProfile(item))
    .find((value) => Object.values(value).some((entry) => entry != null));
  if (profileUpdate) {
    const { error } = await admin
      .from("ig_profiles")
      .update(profileUpdate)
      .eq("id", scrape.ig_profile_id);
    if (error) {
      throw error;
    }
  }

  return { updatedCount, batchHadOlderPost };
}

async function maybeStartDetails(
  admin: AdminClient,
  token: string,
  groupId: string,
): Promise<boolean> {
  const { data: scrapes, error } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("group_id", groupId);

  if (error) {
    throw error;
  }
  if (!listingScrapesAreSettled(scrapes ?? [])) {
    return false;
  }
  if (
    (scrapes ?? []).some(
      (scrape) => scrape.scrape_type === "post_details" && scrape.finished_at == null,
    )
  ) {
    return false;
  }

  const started = await startDetailsBatchForGroup(admin, token, groupId);
  return started != null;
}

async function maybeContinueDetails(
  admin: AdminClient,
  token: string,
  scrape: ScheduledScrape,
  batchHadOlderPost: boolean,
): Promise<boolean> {
  const { data: scrapes, error } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("group_id", scrape.group_id);

  if (error) {
    throw error;
  }

  const listingIds = (scrapes ?? [])
    .filter((row) => row.scrape_type === "posts" || row.scrape_type === "reels")
    .map((row) => row.id);
  const { count: detailedCount, error: detailedError } = await admin
    .from("ig_posts")
    .select("id", { count: "exact", head: true })
    .in("source_scrape_id", listingIds)
    .not("details_scrape_id", "is", null);
  if (detailedError) {
    throw detailedError;
  }

  const { count: pendingCount, error: pendingError } = await admin
    .from("ig_posts")
    .select("id", { count: "exact", head: true })
    .in("source_scrape_id", listingIds)
    .is("details_scrape_id", null);
  if (pendingError) {
    throw pendingError;
  }

  if (
    !shouldContinueDetails({
      pendingUrlCount: pendingCount ?? 0,
      detailedPostCount: detailedCount ?? 0,
      requestedPostCount: scrape.requested_post_count,
      batchHadOlderPost,
    })
  ) {
    return false;
  }

  const started = await startDetailsBatchForGroup(admin, token, scrape.group_id);
  return started != null;
}

async function finishScrape(admin: AdminClient, scrapeId: string): Promise<void> {
  const { error } = await admin
    .from("scheduled_scrapes")
    .update({
      error_message: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", scrapeId);
  if (error) {
    throw error;
  }
}

async function markScrapeFailed(
  admin: AdminClient,
  scrapeId: string,
  message: string,
): Promise<void> {
  const { error } = await admin
    .from("scheduled_scrapes")
    .update({
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", scrapeId);
  if (error) {
    throw error;
  }
}
