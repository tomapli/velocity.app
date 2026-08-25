import { describe, expect, it } from "vitest";

import {
  IG_DATA_SOURCE,
  mergeIgPostValues,
  mergeIgProfileValues,
  resolveSourceValue,
} from "@/lib/ig/source-precedence";
import type { Tables, Updatable } from "@/lib/supabase/tables";

const POST_VALUE_FIELDS = [
  "uploaded_at",
  "thumbnail_url",
  "first_frame_url",
  "video_embed_url",
  "media_type",
  "carousel_image_urls",
  "video_length_secs",
  "view_count",
  "save_count",
  "share_count",
  "comment_count",
  "like_count",
  "description",
  "follows_count",
  "follower_view_count",
  "non_follower_view_count",
  "follower_non_follower_ratio",
  "reach_count",
  "hook_rate",
  "average_watch_time_ms",
  "hold_rate",
] as const satisfies ReadonlyArray<keyof Tables<"ig_posts">>;

const EXISTING_POST = {
  average_watch_time_ms: 1_000,
  carousel_image_urls: ["https://example.com/existing-carousel.jpg"],
  comment_count: 11,
  created_at: "2026-08-25T08:00:00.000Z",
  description: "Existing description",
  details_scrape_id: null,
  first_frame_url: "https://example.com/existing-first-frame.jpg",
  follower_non_follower_ratio: 1.5,
  follower_view_count: 12,
  follows_count: 13,
  hold_rate: 14,
  hook_rate: 15,
  id: "10000000-0000-4000-8000-000000000001",
  ig_profile_id: "10000000-0000-4000-8000-000000000002",
  like_count: 16,
  media_type: "short",
  meta_media_id: null,
  non_follower_view_count: 17,
  post_url: "https://www.instagram.com/p/example/",
  reach_count: 18,
  save_count: 19,
  share_count: 20,
  source_scrape_id: "10000000-0000-4000-8000-000000000003",
  thumbnail_url: "https://example.com/existing-thumbnail.jpg",
  uploaded_at: "2026-08-24T08:00:00.000Z",
  video_embed_url: "https://example.com/existing-video.mp4",
  video_length_secs: 21,
  view_count: 22,
} satisfies Tables<"ig_posts">;

const INCOMING_VALUES = {
  average_watch_time_ms: 2_000,
  carousel_image_urls: ["https://example.com/incoming-carousel.jpg"],
  comment_count: 31,
  description: "Incoming description",
  first_frame_url: "https://example.com/incoming-first-frame.jpg",
  follower_non_follower_ratio: 2.5,
  follower_view_count: 32,
  follows_count: 33,
  hold_rate: 34,
  hook_rate: 35,
  like_count: 36,
  media_type: "carousel",
  non_follower_view_count: 37,
  reach_count: 38,
  save_count: 39,
  share_count: 40,
  thumbnail_url: "https://example.com/incoming-thumbnail.jpg",
  uploaded_at: "2026-08-25T08:00:00.000Z",
  video_embed_url: "https://example.com/incoming-video.mp4",
  video_length_secs: 41,
  view_count: 42,
} satisfies Updatable<"ig_posts">;

describe("resolveSourceValue", () => {
  it("keeps the non-null value regardless of source", () => {
    expect(
      resolveSourceValue(
        "Apify value",
        null,
        IG_DATA_SOURCE.APIFY,
        IG_DATA_SOURCE.META_API,
      ),
    ).toBe("Apify value");
    expect(
      resolveSourceValue(
        null,
        "Apify value",
        IG_DATA_SOURCE.META_API,
        IG_DATA_SOURCE.APIFY,
      ),
    ).toBe("Apify value");
  });

  it("prefers Meta API when both values are non-null", () => {
    expect(
      resolveSourceValue(
        "Apify value",
        "Meta value",
        IG_DATA_SOURCE.APIFY,
        IG_DATA_SOURCE.META_API,
      ),
    ).toBe("Meta value");
    expect(
      resolveSourceValue(
        "Meta value",
        "Apify value",
        IG_DATA_SOURCE.META_API,
        IG_DATA_SOURCE.APIFY,
      ),
    ).toBe("Meta value");
  });

  it("prefers the incoming newest value for the same source", () => {
    expect(
      resolveSourceValue(
        "Older value",
        "Newer value",
        IG_DATA_SOURCE.APIFY,
        IG_DATA_SOURCE.APIFY,
      ),
    ).toBe("Newer value");
  });
});

describe("mergeIgPostValues", () => {
  it("does not let null overwrite any post value", () => {
    const nullValues = Object.fromEntries(
      POST_VALUE_FIELDS.map((field) => [field, null]),
    ) as Updatable<"ig_posts">;
    const merged = mergeIgPostValues(
      EXISTING_POST,
      nullValues,
      IG_DATA_SOURCE.META_API,
    );

    for (const field of POST_VALUE_FIELDS) {
      expect(merged[field]).toEqual(EXISTING_POST[field]);
    }
  });

  it("applies Meta priority to every post value", () => {
    const metaMerged = mergeIgPostValues(
      EXISTING_POST,
      INCOMING_VALUES,
      IG_DATA_SOURCE.META_API,
    );

    for (const field of POST_VALUE_FIELDS) {
      expect(metaMerged[field]).toEqual(INCOMING_VALUES[field]);
    }

    const existingMetaPost = {
      ...EXISTING_POST,
      meta_media_id: "meta-media-id",
    };
    const apifyMerged = mergeIgPostValues(
      existingMetaPost,
      INCOMING_VALUES,
      IG_DATA_SOURCE.APIFY,
    );

    for (const field of POST_VALUE_FIELDS) {
      expect(apifyMerged[field]).toEqual(existingMetaPost[field]);
    }
  });

  it("applies newest-value priority to every same-source post value", () => {
    const merged = mergeIgPostValues(
      EXISTING_POST,
      INCOMING_VALUES,
      IG_DATA_SOURCE.APIFY,
    );

    for (const field of POST_VALUE_FIELDS) {
      expect(merged[field]).toEqual(INCOMING_VALUES[field]);
    }
  });
});

describe("mergeIgProfileValues", () => {
  const existingProfile = {
    created_at: "2026-08-25T08:00:00.000Z",
    created_by: "10000000-0000-4000-8000-000000000001",
    description: "Existing description",
    follower_count: 100,
    id: "10000000-0000-4000-8000-000000000002",
    ig_name: "Existing name",
    ig_username: "example",
    note: null,
    post_count: 10,
    profile_picture_url: "https://example.com/existing-profile.jpg",
    updated_at: "2026-08-25T08:00:00.000Z",
  } satisfies Tables<"ig_profiles">;

  it("applies the same null, source, and newest rules to profile values", () => {
    const nullMerged = mergeIgProfileValues(
      existingProfile,
      {
        description: null,
        follower_count: null,
        ig_name: null,
        post_count: null,
        profile_picture_url: null,
      },
      IG_DATA_SOURCE.APIFY,
      IG_DATA_SOURCE.META_API,
    );
    expect(nullMerged).toEqual({
      description: existingProfile.description,
      follower_count: existingProfile.follower_count,
      ig_name: existingProfile.ig_name,
      post_count: existingProfile.post_count,
      profile_picture_url: existingProfile.profile_picture_url,
    });

    const incoming = {
      description: "Incoming description",
      follower_count: 200,
      ig_name: "Incoming name",
      post_count: 20,
      profile_picture_url: "https://example.com/incoming-profile.jpg",
    };
    expect(
      mergeIgProfileValues(
        existingProfile,
        incoming,
        IG_DATA_SOURCE.APIFY,
        IG_DATA_SOURCE.META_API,
      ),
    ).toEqual(incoming);
    expect(
      mergeIgProfileValues(
        existingProfile,
        incoming,
        IG_DATA_SOURCE.META_API,
        IG_DATA_SOURCE.APIFY,
      ),
    ).toEqual({
      description: existingProfile.description,
      follower_count: existingProfile.follower_count,
      ig_name: existingProfile.ig_name,
      post_count: existingProfile.post_count,
      profile_picture_url: existingProfile.profile_picture_url,
    });
  });
});
