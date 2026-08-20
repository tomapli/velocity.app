import { z } from "zod";

import type { Updatable } from "@/lib/supabase/tables";

const ApifyCaptionSchema = z
  .object({
    text: z.string().nullable().optional(),
  })
  .passthrough();

const ApifyImageVersionSchema = z
  .object({
    url: z.string().url().optional(),
  })
  .passthrough();

const ApifyMediaSchema = z
  .object({
    image_versions: z
      .object({ items: z.array(ApifyImageVersionSchema).optional() })
      .optional(),
    thumbnail_url: z.string().url().optional(),
    video_url: z.string().url().optional(),
  })
  .passthrough();

const ApifyUserSchema = z
  .object({
    biography: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    profile_pic_url: z.string().url().optional(),
    profile_pic_url_hd: z.string().url().optional(),
    username: z.string().nullable().optional(),
  })
  .passthrough();

const ApifyMetricsSchema = z
  .object({
    comment_count: z.number().int().nonnegative().optional(),
    ig_play_count: z.number().int().nonnegative().nullable().optional(),
    like_count: z.number().int().nonnegative().optional(),
    play_count: z.number().int().nonnegative().nullable().optional(),
    save_count: z.number().int().nonnegative().nullable().optional(),
    share_count: z.number().int().nonnegative().nullable().optional(),
    view_count: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough();

export const ApifyInstagramPostDetailsSchema = z
  .object({
    caption: z.union([ApifyCaptionSchema, z.string()]).nullable().optional(),
    carousel_media: z.array(ApifyMediaSchema).optional(),
    code: z.string().min(1).optional(),
    comment_count: z.number().int().nonnegative().optional(),
    image_versions: z
      .object({ items: z.array(ApifyImageVersionSchema).optional() })
      .optional(),
    is_video: z.boolean().optional(),
    like_count: z.number().int().nonnegative().optional(),
    media_type: z.number().int().optional(),
    metrics: ApifyMetricsSchema.optional(),
    play_count: z.number().int().nonnegative().optional(),
    product_type: z.string().optional(),
    save_count: z.number().int().nonnegative().optional(),
    share_count: z.number().int().nonnegative().optional(),
    taken_at: z.number().int().nonnegative().optional(),
    taken_at_date: z.string().optional(),
    thumbnail_url: z.string().url().optional(),
    user: ApifyUserSchema.optional(),
    video_duration: z.number().nonnegative().optional(),
    video_url: z.string().url().optional(),
  })
  .passthrough();

export interface MappedInstagramPostDetails {
  uploaded_at: string;
  thumbnail_url: string | null;
  post_url: string;
  first_frame_url: string | null;
  video_embed_url: string | null;
  media_type: "carousel" | "short" | "static";
  carousel_image_urls: string[] | null;
  video_length_secs: number | null;
  view_count: number | null;
  save_count: number | null;
  share_count: number | null;
  comment_count: number | null;
  like_count: number | null;
  description: string | null;
}

/**
 * Maps a data-slayer/instagram-post-details item onto ig_posts columns.
 */
export function mapInstagramPostDetails(
  value: unknown,
): MappedInstagramPostDetails | null {
  const parsed = ApifyInstagramPostDetailsSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const post = parsed.data;
  const uploadedAt = getUploadedAt(post);
  const postUrl = getPostUrl(post);
  if (!uploadedAt || !postUrl) {
    return null;
  }

  const firstFrameUrl = post.image_versions?.items?.[0]?.url ?? null;
  const carouselImageUrls = post.carousel_media
    ?.map(
      (media) =>
        media.image_versions?.items?.[0]?.url ??
        media.thumbnail_url ??
        media.video_url ??
        null,
    )
    .filter((url): url is string => url !== null);

  return {
    uploaded_at: uploadedAt,
    thumbnail_url: post.thumbnail_url ?? firstFrameUrl,
    post_url: postUrl,
    first_frame_url: firstFrameUrl,
    video_embed_url: post.video_url ?? null,
    media_type: getMediaType(post),
    carousel_image_urls: carouselImageUrls?.length ? carouselImageUrls : null,
    video_length_secs: post.video_duration
      ? Math.round(post.video_duration)
      : null,
    view_count:
      post.metrics?.play_count ??
      post.metrics?.ig_play_count ??
      post.metrics?.view_count ??
      post.play_count ??
      null,
    save_count: post.metrics?.save_count ?? post.save_count ?? null,
    share_count: post.metrics?.share_count ?? post.share_count ?? null,
    comment_count: post.metrics?.comment_count ?? post.comment_count ?? null,
    like_count: post.metrics?.like_count ?? post.like_count ?? null,
    description: getCaptionText(post.caption),
  };
}

export function mapInstagramDetailsProfile(
  value: unknown,
): Updatable<"ig_profiles"> {
  const parsed = ApifyInstagramPostDetailsSchema.safeParse(value);
  if (!parsed.success) {
    return {};
  }

  const user = parsed.data.user;
  return {
    profile_picture_url: user?.profile_pic_url_hd ?? user?.profile_pic_url ?? null,
    ig_name: user?.full_name ?? null,
    description: user?.biography ?? null,
  };
}

function getCaptionText(
  caption: z.infer<typeof ApifyInstagramPostDetailsSchema>["caption"],
): string | null {
  if (typeof caption === "string") {
    return caption;
  }

  return caption?.text ?? null;
}

function getUploadedAt(
  post: z.infer<typeof ApifyInstagramPostDetailsSchema>,
): string | null {
  if (post.taken_at_date) {
    const parsed = Date.parse(post.taken_at_date);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : post.taken_at_date;
  }

  return post.taken_at ? new Date(post.taken_at * 1_000).toISOString() : null;
}

function getPostUrl(
  post: z.infer<typeof ApifyInstagramPostDetailsSchema>,
): string | null {
  if (!post.code) {
    return null;
  }

  return post.product_type === "clips" || post.is_video
    ? `https://www.instagram.com/reel/${post.code}/`
    : `https://www.instagram.com/p/${post.code}/`;
}

function getMediaType(
  post: z.infer<typeof ApifyInstagramPostDetailsSchema>,
): "carousel" | "short" | "static" {
  if (post.carousel_media?.length || post.media_type === 8) {
    return "carousel";
  }

  if (post.is_video || post.product_type === "clips") {
    return "short";
  }

  return "static";
}
