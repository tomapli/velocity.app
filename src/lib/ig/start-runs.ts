import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage } from "@/lib/errors";
import {
  APIFY_DETAILS_BATCH_SIZE,
  APIFY_INSTAGRAM_POST_DETAILS_ACTOR_ID,
  APIFY_INSTAGRAM_PROFILE_POSTS_ACTOR_ID,
  APIFY_INSTAGRAM_SCRAPER_ACTOR_ID,
  startActorRun,
} from "@/lib/apify/client";
import {
  getInstagramShortcode,
  instagramProfileDirectUrl,
  toApifyDateFilter,
} from "@/lib/apify/instagram-listing";
import {
  buildInstagramProfilePostsInput,
  type InstagramProfilePostsRunInput,
} from "@/lib/apify/instagram-profile-posts";
import {
  IG_DEFAULT_REQUESTED_POST_COUNT,
  IG_REQUESTED_POST_COUNT_MAX,
} from "@/lib/ig/constants";
import {
  DETAILS_SCRAPE_STATE_POST_URLS_KEY,
  getDetailsScrapePostUrls,
} from "@/lib/ig/details-scrape-state";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

type AppSupabase = SupabaseClient<Database>;
type Group = Tables<"groups">;
type ScheduledScrape = Tables<"scheduled_scrapes">;

export interface PendingDetailsPost {
  id: string;
  post_url: string;
  uploaded_at: string | null;
}

export interface ListingRunInput {
  scrapeType: "posts" | "reels";
  username: string;
  requestedPostCount: number | null;
  sinceWhen: string | null;
}

/**
 * Starts an apify/instagram-scraper listing run for posts or reels.
 */
export async function startListingRun(
  token: string,
  input: ListingRunInput,
) {
  const resultsLimit = input.sinceWhen
    ? IG_REQUESTED_POST_COUNT_MAX
    : (input.requestedPostCount ?? IG_DEFAULT_REQUESTED_POST_COUNT);

  return startActorRun(token, APIFY_INSTAGRAM_SCRAPER_ACTOR_ID, {
    directUrls: [instagramProfileDirectUrl(input.username)],
    resultsType: input.scrapeType,
    resultsLimit,
    ...(input.sinceWhen
      ? { onlyPostsNewerThan: toApifyDateFilter(input.sinceWhen) }
      : {}),
  });
}

/**
 * Starts a data-slayer/instagram-posts run that lists the profile feed with
 * post metrics in one go, so no post-details batches follow.
 */
export async function startProfilePostsRun(
  token: string,
  input: InstagramProfilePostsRunInput,
) {
  return startActorRun(
    token,
    APIFY_INSTAGRAM_PROFILE_POSTS_ACTOR_ID,
    buildInstagramProfilePostsInput(input),
  );
}

/**
 * Starts a post-details run for up to 100 not-yet-attempted URLs in a scrape group.
 */
export async function startDetailsBatchForGroup(
  supabase: AppSupabase,
  token: string,
  groupId: string,
): Promise<ScheduledScrape | null> {
  const [
    { data: group, error: groupError },
    { data: groupScrapes, error: scrapesError },
  ] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).single(),
    supabase
      .from("scheduled_scrapes")
      .select("*")
      .eq("group_id", groupId),
  ]);

  if (groupError) {
    throw groupError;
  }
  if (scrapesError) {
    throw scrapesError;
  }

  if (hasInFlightDetailsScrape(groupScrapes ?? [])) {
    return null;
  }

  const listingScrapes = (groupScrapes ?? []).filter(
    (scrape) => scrape.scrape_type === "posts" || scrape.scrape_type === "reels",
  );
  if (listingScrapes.length === 0) {
    return null;
  }

  const listingIds = listingScrapes.map((scrape) => scrape.id);
  const attemptedShortcodes = getAttemptedDetailsShortcodes(groupScrapes ?? []);
  const remainingSlots = getRemainingDetailSlots(
    group,
    await countDetailedPosts(supabase, listingIds),
  );
  if (remainingSlots <= 0) {
    return null;
  }

  const pending = await listPendingPostUrls(
    supabase,
    listingIds,
    group.since_when,
    Math.min(APIFY_DETAILS_BATCH_SIZE, remainingSlots),
    attemptedShortcodes,
  );
  if (pending.length === 0) {
    return null;
  }

  const { data: detailsScrape, error: insertError } = await supabase
    .from("scheduled_scrapes")
    .insert({
      group_id: groupId,
      scrape_type: "post_details",
      state: {
        [DETAILS_SCRAPE_STATE_POST_URLS_KEY]: pending.map(
          (post) => post.post_url,
        ),
      },
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  try {
    if (!(await ownsDetailsBatch(supabase, groupId, detailsScrape.id))) {
      const { error: releaseError } = await supabase
        .from("scheduled_scrapes")
        .update({
          finished_at: new Date().toISOString(),
          state: {},
        })
        .eq("id", detailsScrape.id);
      if (releaseError) {
        throw releaseError;
      }
      return null;
    }

    const run = await startActorRun(token, APIFY_INSTAGRAM_POST_DETAILS_ACTOR_ID, {
      postUrls: pending.map((post) => post.post_url),
    });
    const { data: updated, error: updateError } = await supabase
      .from("scheduled_scrapes")
      .update({
        apify_called_at: new Date().toISOString(),
        apify_run_id: run.id,
      })
      .eq("id", detailsScrape.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return updated;
  } catch (error) {
    const message = getErrorMessage(error, "Could not start Apify");
    await supabase
      .from("scheduled_scrapes")
      .update({
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", detailsScrape.id);
    throw error;
  }
}

export function shouldContinueDetails(params: {
  pendingUrlCount: number;
  detailedPostCount: number;
  requestedPostCount: number | null;
  batchHadOlderPost: boolean;
  batchUpdatedCount: number;
}): boolean {
  if (params.batchHadOlderPost || params.pendingUrlCount <= 0) {
    return false;
  }

  if (params.batchUpdatedCount <= 0) {
    return false;
  }

  if (
    params.requestedPostCount != null &&
    params.detailedPostCount >= params.requestedPostCount
  ) {
    return false;
  }

  return true;
}

export function hasInFlightDetailsScrape(scrapes: ScheduledScrape[]): boolean {
  return scrapes.some(
    (scrape) => scrape.scrape_type === "post_details" && scrape.finished_at == null,
  );
}

export function listingScrapesAreSettled(scrapes: ScheduledScrape[]): boolean {
  const listing = scrapes.filter(
    (scrape) => scrape.scrape_type === "posts" || scrape.scrape_type === "reels",
  );

  return listing.length >= 2 && listing.every((scrape) => scrape.finished_at);
}

async function countDetailedPosts(
  supabase: AppSupabase,
  listingIds: string[],
): Promise<number> {
  const { data, error } = await supabase
    .from("ig_posts")
    .select("post_url")
    .in("source_scrape_id", listingIds)
    .not("details_scrape_id", "is", null);

  if (error) {
    throw error;
  }

  return countUniqueShortcodes((data ?? []).map((post) => post.post_url));
}

async function listPendingPostUrls(
  supabase: AppSupabase,
  listingIds: string[],
  sinceWhen: string | null,
  limit: number,
  attemptedShortcodes: ReadonlySet<string>,
): Promise<PendingDetailsPost[]> {
  const { data, error } = await supabase
    .from("ig_posts")
    .select("id, post_url, uploaded_at")
    .in("source_scrape_id", listingIds)
    .is("details_scrape_id", null)
    .order("uploaded_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return selectPendingDetailsPosts(
    data ?? [],
    sinceWhen,
    limit,
    attemptedShortcodes,
  );
}

export function selectPendingDetailsPosts(
  posts: PendingDetailsPost[],
  sinceWhen: string | null,
  limit: number,
  attemptedShortcodes: ReadonlySet<string>,
): PendingDetailsPost[] {
  const sinceTimestamp = sinceWhen ? Date.parse(sinceWhen) : null;

  const seenShortcodes = new Set<string>();

  return posts
    .filter((post) => {
      if (!sinceTimestamp || !post.uploaded_at) {
        return true;
      }

      const uploadedAt = Date.parse(post.uploaded_at);
      return !Number.isFinite(uploadedAt) || uploadedAt >= sinceTimestamp;
    })
    .filter((post) => {
      const shortcode = getInstagramShortcode(post.post_url);
      if (
        !shortcode ||
        seenShortcodes.has(shortcode) ||
        attemptedShortcodes.has(shortcode)
      ) {
        return false;
      }

      seenShortcodes.add(shortcode);
      return true;
    })
    .slice(0, limit);
}

export function getAttemptedDetailsShortcodes(
  scrapes: ScheduledScrape[],
): Set<string> {
  const shortcodes = new Set<string>();

  for (const scrape of scrapes) {
    if (scrape.scrape_type !== "post_details") {
      continue;
    }

    for (const postUrl of getDetailsScrapePostUrls(scrape.state)) {
      const shortcode = getInstagramShortcode(postUrl);
      if (shortcode) {
        shortcodes.add(shortcode);
      }
    }
  }

  return shortcodes;
}

async function ownsDetailsBatch(
  supabase: AppSupabase,
  groupId: string,
  scrapeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("scheduled_scrapes")
    .select("id")
    .eq("group_id", groupId)
    .eq("scrape_type", "post_details")
    .is("finished_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id === scrapeId;
}

function getRemainingDetailSlots(
  group: Group,
  detailedPostCount: number,
): number {
  if (group.requested_post_count == null) {
    return APIFY_DETAILS_BATCH_SIZE;
  }

  return Math.max(0, group.requested_post_count - detailedPostCount);
}

function countUniqueShortcodes(postUrls: string[]): number {
  const shortcodes = new Set<string>();

  for (const postUrl of postUrls) {
    const shortcode = getInstagramShortcode(postUrl);
    if (shortcode) {
      shortcodes.add(shortcode);
    }
  }

  return shortcodes.size;
}
