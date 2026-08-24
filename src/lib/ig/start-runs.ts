import type { SupabaseClient } from "@supabase/supabase-js";

import {
  APIFY_DETAILS_BATCH_SIZE,
  APIFY_INSTAGRAM_POST_DETAILS_ACTOR_ID,
  APIFY_INSTAGRAM_SCRAPER_ACTOR_ID,
  startActorRun,
} from "@/lib/apify/client";
import {
  getInstagramShortcode,
  instagramProfileDirectUrl,
  toApifyDateFilter,
} from "@/lib/apify/instagram-listing";
import {
  IG_DEFAULT_REQUESTED_POST_COUNT,
  IG_REQUESTED_POST_COUNT_MAX,
} from "@/lib/ig/constants";
import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

type AppSupabase = SupabaseClient<Database>;
type Group = Tables<"groups">;
type ScheduledScrape = Tables<"scheduled_scrapes">;

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
 * Starts a post-details run for up to 100 pending URLs in a scrape group.
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

  const template = listingScrapes[0];
  const listingIds = listingScrapes.map((scrape) => scrape.id);
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
  );
  if (pending.length === 0) {
    return null;
  }

  const { data: detailsScrape, error: insertError } = await supabase
    .from("scheduled_scrapes")
    .insert({
      group_id: groupId,
      scrape_type: "post_details",
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  try {
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
    const message = error instanceof Error ? error.message : "Could not start Apify";
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
): Promise<Array<{ id: string; post_url: string }>> {
  const { data, error } = await supabase
    .from("ig_posts")
    .select("id, post_url, uploaded_at")
    .in("source_scrape_id", listingIds)
    .is("details_scrape_id", null)
    .order("uploaded_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  const sinceTimestamp = sinceWhen ? Date.parse(sinceWhen) : null;

  const seenShortcodes = new Set<string>();

  return (data ?? [])
    .filter((post) => {
      if (!sinceTimestamp || !post.uploaded_at) {
        return true;
      }

      const uploadedAt = Date.parse(post.uploaded_at);
      return !Number.isFinite(uploadedAt) || uploadedAt >= sinceTimestamp;
    })
    .filter((post) => {
      const shortcode = getInstagramShortcode(post.post_url);
      if (!shortcode || seenShortcodes.has(shortcode)) {
        return false;
      }

      seenShortcodes.add(shortcode);
      return true;
    })
    .slice(0, limit);
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
