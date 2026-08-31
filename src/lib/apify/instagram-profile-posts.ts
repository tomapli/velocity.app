import {
  APIFY_PROFILE_POSTS_MAX_PAGES,
  APIFY_PROFILE_POSTS_PER_PAGE,
} from "@/lib/apify/client";
import { getCanonicalInstagramPostUrl } from "@/lib/apify/instagram-listing";
import {
  mapInstagramPostDetails,
  type MappedInstagramPostDetails,
} from "@/lib/apify/instagram-post-details";
import {
  IG_DEFAULT_REQUESTED_POST_COUNT,
  IG_REQUESTED_POST_COUNT_MAX,
} from "@/lib/ig/constants";
import type { Insertable } from "@/lib/supabase/tables";

export interface InstagramProfilePostsRunInput {
  username: string;
  requestedPostCount: number | null;
  sinceWhen: string | null;
}

/** Actor input accepted by data-slayer/instagram-posts. */
export interface InstagramProfilePostsActorInput {
  username: string;
  maxPages: number;
}

export interface InstagramProfilePostsSelection {
  requestedPostCount: number | null;
  sinceWhen: string | null;
}

/**
 * Converts the requested post count into the actor's page count. The actor has
 * no date filter, so a start date fetches the maximum and filters afterwards.
 */
export function getProfilePostsMaxPages(
  requestedPostCount: number | null,
  sinceWhen: string | null,
): number {
  const postLimit = sinceWhen
    ? IG_REQUESTED_POST_COUNT_MAX
    : (requestedPostCount ?? IG_DEFAULT_REQUESTED_POST_COUNT);
  const pages = Math.ceil(postLimit / APIFY_PROFILE_POSTS_PER_PAGE);

  return Math.min(APIFY_PROFILE_POSTS_MAX_PAGES, Math.max(1, pages));
}

export function buildInstagramProfilePostsInput(
  input: InstagramProfilePostsRunInput,
): InstagramProfilePostsActorInput {
  return {
    username: input.username,
    maxPages: getProfilePostsMaxPages(input.requestedPostCount, input.sinceWhen),
  };
}

/**
 * Maps a data-slayer/instagram-posts dataset onto canonical post rows: newest
 * first, deduplicated, cut off at the start date and the requested count.
 */
export function mapInstagramProfilePosts(
  dataset: unknown[],
  selection: InstagramProfilePostsSelection,
): MappedInstagramPostDetails[] {
  const sinceTimestamp = selection.sinceWhen ? Date.parse(selection.sinceWhen) : null;
  const byUrl = new Map<string, MappedInstagramPostDetails>();

  for (const item of dataset) {
    const details = mapInstagramPostDetails(item);
    if (!details) {
      continue;
    }

    const uploadedAt = Date.parse(details.uploaded_at);
    if (sinceTimestamp && Number.isFinite(uploadedAt) && uploadedAt < sinceTimestamp) {
      continue;
    }

    const postUrl = getCanonicalInstagramPostUrl(details.post_url);
    if (!byUrl.has(postUrl)) {
      byUrl.set(postUrl, { ...details, post_url: postUrl });
    }
  }

  const sorted = [...byUrl.values()].sort(compareByUploadedAtDesc);

  return selection.requestedPostCount != null
    ? sorted.slice(0, selection.requestedPostCount)
    : sorted;
}

/**
 * Builds the row for a post that arrived with its details already attached, so
 * the scrape counts as both its listing and its details source.
 */
export function toProfilePostRow(
  profileId: string,
  scrapeId: string,
  post: MappedInstagramPostDetails,
): Insertable<"ig_posts"> {
  return {
    ig_profile_id: profileId,
    source_scrape_id: scrapeId,
    details_scrape_id: scrapeId,
    ...post,
  };
}

function compareByUploadedAtDesc(
  left: MappedInstagramPostDetails,
  right: MappedInstagramPostDetails,
): number {
  const leftTime = Date.parse(left.uploaded_at);
  const rightTime = Date.parse(right.uploaded_at);
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid && rightValid) {
    return rightTime - leftTime;
  }
  if (leftValid) {
    return -1;
  }
  return rightValid ? 1 : 0;
}
