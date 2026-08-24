import { z } from "zod";

import type { Insertable, Updatable } from "@/lib/supabase/tables";

const INSTAGRAM_CANONICAL_POST_URL_PREFIX = "https://www.instagram.com/p";

const ListingItemSchema = z
  .object({
    biography: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    displayUrl: z.string().url().optional(),
    ownerFullName: z.string().nullable().optional(),
    ownerUsername: z.string().nullable().optional(),
    postsCount: z.number().int().nonnegative().optional(),
    profilePicUrl: z.string().url().optional(),
    profilePicUrlHD: z.string().url().optional(),
    shortCode: z.string().min(1).optional(),
    timestamp: z.string().optional(),
    type: z.string().optional(),
    url: z.string().url().optional(),
    username: z.string().nullable().optional(),
  })
  .passthrough();

export interface InstagramListingItem {
  postUrl: string;
  uploadedAt: string | null;
  thumbnailUrl: string | null;
}

/**
 * Builds the public Instagram profile URL used as Apify listing input.
 */
export function instagramProfileDirectUrl(username: string): string {
  return `https://www.instagram.com/${username}/`;
}

/**
 * Formats a cutoff timestamp as the YYYY-MM-DD value Apify date filters expect.
 */
export function toApifyDateFilter(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Extracts post/reel URLs from an apify/instagram-scraper dataset item.
 */
export function mapInstagramListingItem(value: unknown): InstagramListingItem | null {
  const parsed = ListingItemSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const postUrl = getListingPostUrl(parsed.data);
  if (!postUrl) {
    return null;
  }

  return {
    postUrl,
    uploadedAt: getListingUploadedAt(parsed.data.timestamp),
    thumbnailUrl: parsed.data.displayUrl ?? null,
  };
}

export function mapInstagramListingProfile(
  value: unknown,
  expectedUsername: string,
): Updatable<"ig_profiles"> {
  const parsed = ListingItemSchema.safeParse(value);
  if (!parsed.success) {
    return {};
  }

  const item = parsed.data;
  const ownerUsername = item.ownerUsername ?? item.username;
  if (!usernamesMatch(ownerUsername, expectedUsername)) {
    return {};
  }

  return {
    profile_picture_url: item.profilePicUrlHD ?? item.profilePicUrl ?? null,
    ig_name: item.ownerFullName ?? null,
    description: item.biography ?? null,
    post_count: item.postsCount ?? null,
  };
}

function usernamesMatch(
  actualUsername: string | null | undefined,
  expectedUsername: string,
): boolean {
  return actualUsername?.trim().toLowerCase() === expectedUsername.trim().toLowerCase();
}

export function toPendingIgPost(
  profileId: string,
  sourceScrapeId: string,
  item: InstagramListingItem,
): Insertable<"ig_posts"> {
  return {
    ig_profile_id: profileId,
    source_scrape_id: sourceScrapeId,
    details_scrape_id: null,
    post_url: item.postUrl,
    uploaded_at: item.uploadedAt,
    thumbnail_url: item.thumbnailUrl,
  };
}

function getListingPostUrl(
  item: z.infer<typeof ListingItemSchema>,
): string | null {
  if (item.url) {
    return getCanonicalInstagramPostUrl(item.url);
  }

  if (!item.shortCode) {
    return null;
  }

  return buildCanonicalInstagramPostUrl(item.shortCode);
}

/**
 * Extracts an Instagram shortcode from a post or reel URL.
 */
export function getInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|reels)\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

/**
 * Normalizes post and reel aliases onto the URL used by the database unique key.
 */
export function getCanonicalInstagramPostUrl(url: string): string {
  const shortcode = getInstagramShortcode(url);
  return shortcode ? buildCanonicalInstagramPostUrl(shortcode) : url;
}

function buildCanonicalInstagramPostUrl(shortcode: string): string {
  return `${INSTAGRAM_CANONICAL_POST_URL_PREFIX}/${shortcode}/`;
}

function getListingUploadedAt(timestamp: string | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
