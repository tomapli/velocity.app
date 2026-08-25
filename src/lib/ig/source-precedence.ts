import type { Tables, Updatable } from "@/lib/supabase/tables";

export const IG_DATA_SOURCE = {
  APIFY: "apify",
  META_API: "meta_api",
} as const;

export type IgDataSource = (typeof IG_DATA_SOURCE)[keyof typeof IG_DATA_SOURCE];

const SOURCE_PRIORITY = {
  [IG_DATA_SOURCE.APIFY]: 0,
  [IG_DATA_SOURCE.META_API]: 1,
} as const satisfies Record<IgDataSource, number>;

type IgPost = Tables<"ig_posts">;
type IgProfile = Tables<"ig_profiles">;

/**
 * Resolves one scraped value. Null never replaces data, Meta beats Apify, and
 * the incoming value wins when both values came from the same source.
 */
export function resolveSourceValue<T>(
  existingValue: T | null | undefined,
  incomingValue: T | null | undefined,
  existingSource: IgDataSource,
  incomingSource: IgDataSource,
): T | null {
  if (incomingValue == null) {
    return existingValue ?? null;
  }
  if (existingValue == null) {
    return incomingValue;
  }

  return SOURCE_PRIORITY[incomingSource] >= SOURCE_PRIORITY[existingSource]
    ? incomingValue
    : existingValue;
}

/** Applies source precedence independently to every scraped post field. */
export function mergeIgPostValues(
  existing: IgPost,
  incoming: Updatable<"ig_posts">,
  incomingSource: IgDataSource,
): Updatable<"ig_posts"> {
  const existingSource = existing.meta_media_id
    ? IG_DATA_SOURCE.META_API
    : IG_DATA_SOURCE.APIFY;
  const resolve = <T>(
    existingValue: T | null | undefined,
    incomingValue: T | null | undefined,
  ): T | null =>
    resolveSourceValue(
      existingValue,
      incomingValue,
      existingSource,
      incomingSource,
    );

  return {
    uploaded_at: resolve(existing.uploaded_at, incoming.uploaded_at),
    thumbnail_url: resolve(existing.thumbnail_url, incoming.thumbnail_url),
    first_frame_url: resolve(existing.first_frame_url, incoming.first_frame_url),
    video_embed_url: resolve(existing.video_embed_url, incoming.video_embed_url),
    media_type: resolve(existing.media_type, incoming.media_type),
    carousel_image_urls: resolve(
      existing.carousel_image_urls,
      incoming.carousel_image_urls,
    ),
    video_length_secs: resolve(
      existing.video_length_secs,
      incoming.video_length_secs,
    ),
    view_count: resolve(existing.view_count, incoming.view_count),
    save_count: resolve(existing.save_count, incoming.save_count),
    share_count: resolve(existing.share_count, incoming.share_count),
    comment_count: resolve(existing.comment_count, incoming.comment_count),
    like_count: resolve(existing.like_count, incoming.like_count),
    description: resolve(existing.description, incoming.description),
    follows_count: resolve(existing.follows_count, incoming.follows_count),
    follower_view_count: resolve(
      existing.follower_view_count,
      incoming.follower_view_count,
    ),
    non_follower_view_count: resolve(
      existing.non_follower_view_count,
      incoming.non_follower_view_count,
    ),
    follower_non_follower_ratio: resolve(
      existing.follower_non_follower_ratio,
      incoming.follower_non_follower_ratio,
    ),
    reach_count: resolve(existing.reach_count, incoming.reach_count),
    hook_rate: resolve(existing.hook_rate, incoming.hook_rate),
    average_watch_time_ms: resolve(
      existing.average_watch_time_ms,
      incoming.average_watch_time_ms,
    ),
    hold_rate: resolve(existing.hold_rate, incoming.hold_rate),
  };
}

/** Applies source precedence independently to every scraped profile field. */
export function mergeIgProfileValues(
  existing: IgProfile,
  incoming: Updatable<"ig_profiles">,
  existingSource: IgDataSource,
  incomingSource: IgDataSource,
): Updatable<"ig_profiles"> {
  const resolve = <T>(
    existingValue: T | null | undefined,
    incomingValue: T | null | undefined,
  ): T | null =>
    resolveSourceValue(
      existingValue,
      incomingValue,
      existingSource,
      incomingSource,
    );

  return {
    profile_picture_url: resolve(
      existing.profile_picture_url,
      incoming.profile_picture_url,
    ),
    ig_name: resolve(existing.ig_name, incoming.ig_name),
    description: resolve(existing.description, incoming.description),
    post_count: resolve(existing.post_count, incoming.post_count),
    follower_count: resolve(existing.follower_count, incoming.follower_count),
  };
}
