import type { SupabaseClient } from "@supabase/supabase-js";

import { getActorRun, getDatasetItems } from "@/lib/apify/client";
import {
  getCanonicalInstagramPostUrl,
  getInstagramShortcode,
  mapInstagramListingItem,
  mapInstagramListingProfile,
  toPendingIgPost,
} from "@/lib/apify/instagram-listing";
import {
  mapInstagramDetailsProfile,
  mapInstagramPostDetails,
  toInstagramPostDetailsUpdate,
} from "@/lib/apify/instagram-post-details";
import {
  hasInFlightDetailsScrape,
  listingScrapesAreSettled,
  shouldContinueDetails,
  startDetailsBatchForGroup,
} from "@/lib/ig/start-runs";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";
import type { Updatable } from "@/lib/supabase/tables";

const APIFY_SUCCESS_STATUS = "SUCCEEDED";
const APIFY_FAILED_STATUSES = new Set(["ABORTED", "FAILED", "TIMED-OUT"]);
const UPSERT_BATCH_SIZE = 100;
const PERCENT_MAX = 100;
const MILLISECONDS_PER_SECOND = 1_000;

type AdminClient = SupabaseClient<Database>;
type Group = Tables<"groups">;
type IgProfile = Tables<"ig_profiles">;
type ScheduledScrape = Tables<"scheduled_scrapes">;
type IgPostRow = Tables<"ig_posts">;

/**
 * Imports a succeeded Apify run for a scheduled scrape row.
 */
export async function processSucceededApifyRun(
  admin: AdminClient,
  scrape: ScheduledScrape,
  token: string,
  datasetId?: string | null,
): Promise<{ importedPostCount?: number; batchHadOlderPost?: boolean }> {
  const group = await getGroup(admin, scrape.group_id);
  const profile = await getProfile(admin, group.ig_profile_id);
  const actorRun = datasetId ? null : await getActorRun(token, scrape.apify_run_id!);
  const dataset = await getDatasetItems(
    token,
    datasetId ?? actorRun!.defaultDatasetId,
  );

  if (scrape.scrape_type === "post_details") {
    const imported = await importDetails(admin, profile, group, scrape, dataset);
    await finishScrape(admin, scrape.id);

    return {
      importedPostCount: imported.updatedCount,
      batchHadOlderPost: imported.batchHadOlderPost,
    };
  }

  await importListing(admin, profile, group, scrape, dataset);
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
  batchUpdatedCount = 0,
): Promise<{ startedDetails?: boolean; continued?: boolean }> {
  if (scrape?.scrape_type === "post_details") {
    const continued = await maybeContinueDetails(
      admin,
      token,
      scrape,
      batchHadOlderPost,
      batchUpdatedCount,
    );
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
  profile: IgProfile,
  group: Group,
  scrape: ScheduledScrape,
  dataset: unknown[],
): Promise<void> {
  const items = dataset
    .map((item) => mapInstagramListingItem(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const sinceTimestamp = group.since_when ? Date.parse(group.since_when) : null;
  const pending = items
    .filter((item) => {
      if (!sinceTimestamp || !item.uploadedAt) {
        return true;
      }

      const uploadedAt = Date.parse(item.uploadedAt);
      return !Number.isFinite(uploadedAt) || uploadedAt >= sinceTimestamp;
    })
    .map((item) => toPendingIgPost(group.ig_profile_id, scrape.id, item));
  const pendingByUrl = new Map(pending.map((post) => [post.post_url, post]));
  const uniquePending = [...pendingByUrl.values()];

  const { data: existingPosts, error: existingPostsError } = await admin
    .from("ig_posts")
    .select("*")
    .eq("ig_profile_id", group.ig_profile_id);
  if (existingPostsError) {
    throw existingPostsError;
  }

  const existingByUrl = new Map(
    (existingPosts ?? []).map((post) => [getCanonicalInstagramPostUrl(post.post_url), post]),
  );
  const mergedPending = uniquePending.map((post) => {
    const existing = existingByUrl.get(post.post_url);
    if (group.data_source !== "meta_hybrid") {
      return {
        ...post,
        meta_media_id: null,
        follows_count: null,
        follower_view_count: null,
        non_follower_view_count: null,
        follower_non_follower_ratio: null,
        reach_count: null,
        hook_rate: null,
        average_watch_time_ms: null,
        hold_rate: null,
      };
    }
    if (!existing?.meta_media_id) {
      return post;
    }
    return {
      ...post,
      uploaded_at: existing.uploaded_at ?? post.uploaded_at,
      thumbnail_url: existing.thumbnail_url ?? post.thumbnail_url,
    };
  });

  for (let index = 0; index < mergedPending.length; index += UPSERT_BATCH_SIZE) {
    const { error } = await admin.from("ig_posts").upsert(
      mergedPending.slice(index, index + UPSERT_BATCH_SIZE),
      {
        onConflict: "ig_profile_id,post_url",
      },
    );
    if (error) {
      throw error;
    }
  }

  const importedUrls = new Set(uniquePending.map((post) => post.post_url));
  const duplicateIds = (existingPosts ?? [])
    .filter((post) => {
      const canonicalUrl = getCanonicalInstagramPostUrl(post.post_url);
      return importedUrls.has(canonicalUrl) && post.post_url !== canonicalUrl;
    })
    .map((post) => post.id);

  for (let index = 0; index < duplicateIds.length; index += UPSERT_BATCH_SIZE) {
    const { error } = await admin
      .from("ig_posts")
      .delete()
      .in("id", duplicateIds.slice(index, index + UPSERT_BATCH_SIZE));
    if (error) {
      throw error;
    }
  }

  const profileUpdate = dataset
    .map((item) => mapInstagramListingProfile(item, profile.ig_username))
    .find((value) => Object.values(value).some((entry) => entry != null));
  if (profileUpdate) {
    const { error } = await admin
      .from("ig_profiles")
      .update(
        group.data_source === "meta_hybrid"
          ? mergeProfileUpdate(profile, profileUpdate)
          : profileUpdate,
      )
      .eq("id", profile.id);
    if (error) {
      throw error;
    }
  }
}

async function importDetails(
  admin: AdminClient,
  profile: IgProfile,
  group: Group,
  scrape: ScheduledScrape,
  dataset: unknown[],
): Promise<{ updatedCount: number; batchHadOlderPost: boolean }> {
  const { data: existing, error: existingError } = await admin
    .from("ig_posts")
    .select("*")
    .eq("ig_profile_id", group.ig_profile_id);

  if (existingError) {
    throw existingError;
  }

  const byShortcode = new Map<string, IgPostRow[]>();

  for (const post of existing ?? []) {
    const shortcode = getInstagramShortcode(post.post_url);
    if (!shortcode) {
      continue;
    }

    const ids = byShortcode.get(shortcode) ?? [];
    ids.push(post);
    byShortcode.set(shortcode, ids);
  }

  const sinceTimestamp = group.since_when ? Date.parse(group.since_when) : null;
  let updatedCount = 0;
  let batchHadOlderPost = false;

  for (const item of dataset) {
    const details = mapInstagramPostDetails(item);
    if (!details) {
      continue;
    }

    const shortcode = getInstagramShortcode(details.post_url);
    const detailsUpdate = toInstagramPostDetailsUpdate(details);
    const postIds = shortcode ? byShortcode.get(shortcode) : undefined;
    if (!postIds?.length) {
      continue;
    }

    const uploadedAt = Date.parse(details.uploaded_at);
    if (sinceTimestamp && Number.isFinite(uploadedAt) && uploadedAt < sinceTimestamp) {
      batchHadOlderPost = true;
      continue;
    }

    for (const post of postIds) {
      const mergedUpdate =
        group.data_source === "meta_hybrid" && post.meta_media_id
          ? mergeApifyDetails(post, detailsUpdate)
          : detailsUpdate;
      const { error } = await admin
        .from("ig_posts")
        .update({
          ...mergedUpdate,
          details_scrape_id: scrape.id,
        })
        .eq("id", post.id);
      if (error) {
        throw error;
      }

      updatedCount += 1;
    }
  }

  const profileUpdate = dataset
    .map((item) => mapInstagramDetailsProfile(item, profile.ig_username))
    .find((value) => Object.values(value).some((entry) => entry != null));
  if (profileUpdate) {
    const { error } = await admin
      .from("ig_profiles")
      .update(
        group.data_source === "meta_hybrid"
          ? mergeProfileUpdate(profile, profileUpdate)
          : profileUpdate,
      )
      .eq("id", profile.id);
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
  if (hasInFlightDetailsScrape(scrapes ?? [])) {
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
  batchUpdatedCount: number,
): Promise<boolean> {
  const [
    { data: group, error: groupError },
    { data: scrapes, error: scrapesError },
  ] = await Promise.all([
    admin.from("groups").select("*").eq("id", scrape.group_id).single(),
    admin.from("scheduled_scrapes").select("*").eq("group_id", scrape.group_id),
  ]);

  if (groupError) {
    throw groupError;
  }
  if (scrapesError) {
    throw scrapesError;
  }

  if (hasInFlightDetailsScrape(scrapes ?? [])) {
    return false;
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
      requestedPostCount: group.requested_post_count,
      batchHadOlderPost,
      batchUpdatedCount,
    })
  ) {
    return false;
  }

  const started = await startDetailsBatchForGroup(admin, token, scrape.group_id);
  return started != null;
}

async function getGroup(admin: AdminClient, groupId: string): Promise<Group> {
  const { data, error } = await admin
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getProfile(
  admin: AdminClient,
  profileId: string,
): Promise<IgProfile> {
  const { data, error } = await admin
    .from("ig_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function mergeApifyDetails(
  existing: IgPostRow,
  update: Updatable<"ig_posts">,
): Updatable<"ig_posts"> {
  const videoLengthSecs = existing.video_length_secs ?? update.video_length_secs ?? null;
  const averageWatchTimeMs = existing.average_watch_time_ms;
  return {
    uploaded_at: existing.uploaded_at ?? update.uploaded_at,
    thumbnail_url: existing.thumbnail_url ?? update.thumbnail_url,
    first_frame_url: existing.first_frame_url ?? update.first_frame_url,
    video_embed_url: existing.video_embed_url ?? update.video_embed_url,
    media_type: existing.media_type ?? update.media_type,
    carousel_image_urls: existing.carousel_image_urls ?? update.carousel_image_urls,
    video_length_secs: videoLengthSecs,
    view_count: existing.view_count ?? update.view_count,
    save_count: existing.save_count ?? update.save_count,
    share_count: existing.share_count ?? update.share_count,
    comment_count: existing.comment_count ?? update.comment_count,
    like_count: existing.like_count ?? update.like_count,
    description: existing.description ?? update.description,
    hold_rate:
      existing.hold_rate ??
      (averageWatchTimeMs != null && videoLengthSecs != null && videoLengthSecs > 0
        ? (averageWatchTimeMs / (videoLengthSecs * MILLISECONDS_PER_SECOND)) *
          PERCENT_MAX
        : null),
  };
}

function mergeProfileUpdate(
  existing: IgProfile,
  update: Updatable<"ig_profiles">,
): Updatable<"ig_profiles"> {
  return {
    profile_picture_url:
      existing.profile_picture_url ?? update.profile_picture_url,
    ig_name: existing.ig_name ?? update.ig_name,
    description: existing.description ?? update.description,
    post_count: existing.post_count ?? update.post_count,
  };
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
