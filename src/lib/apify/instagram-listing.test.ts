import { describe, expect, it } from "vitest";

import {
  getCanonicalInstagramPostUrl,
  getInstagramShortcode,
  mapInstagramListingItem,
  mapInstagramListingProfile,
} from "@/lib/apify/instagram-listing";
import {
  mapInstagramDetailsProfile,
  mapInstagramPostDetails,
  toInstagramPostDetailsUpdate,
} from "@/lib/apify/instagram-post-details";

describe("mapInstagramListingItem", () => {
  it("keeps the listing URL and timestamp for later detail scrapes", () => {
    expect(
      mapInstagramListingItem({
        displayUrl: "https://example.com/thumb.jpg",
        timestamp: "2026-08-20T10:00:00.000Z",
        url: "https://www.instagram.com/p/ABC123/",
      }),
    ).toEqual({
      postUrl: "https://www.instagram.com/p/ABC123/",
      uploadedAt: "2026-08-20T10:00:00.000Z",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });
  });

  it("uses the same canonical URL for post and reel aliases", () => {
    expect(
      mapInstagramListingItem({
        shortCode: "DEF456",
        type: "Video",
      }),
    ).toMatchObject({
      postUrl: "https://www.instagram.com/p/DEF456/",
    });

    expect(
      mapInstagramListingItem({
        url: "https://www.instagram.com/reel/DEF456/?hl=en",
      }),
    ).toMatchObject({
      postUrl: "https://www.instagram.com/p/DEF456/",
    });
  });
});

describe("getInstagramShortcode", () => {
  it("reads shortcodes from post and reel URLs", () => {
    expect(getInstagramShortcode("https://www.instagram.com/p/ABC123/")).toBe("ABC123");
    expect(getInstagramShortcode("https://www.instagram.com/reel/DEF456/?hl=en")).toBe(
      "DEF456",
    );
  });

  it("canonicalizes post and reel aliases to one unique URL", () => {
    expect(
      getCanonicalInstagramPostUrl(
        "https://www.instagram.com/reel/DEF456/?hl=en",
      ),
    ).toBe("https://www.instagram.com/p/DEF456/");
  });
});

describe("mapInstagramListingProfile", () => {
  it("maps owner fields from a listing item", () => {
    expect(
      mapInstagramListingProfile({
        biography: "Bio",
        ownerFullName: "Velocity",
        postsCount: 12,
        profilePicUrlHD: "https://example.com/hd.jpg",
      }),
    ).toEqual({
      description: "Bio",
      ig_name: "Velocity",
      post_count: 12,
      profile_picture_url: "https://example.com/hd.jpg",
    });
  });
});

describe("mapInstagramPostDetails", () => {
  it("maps every available post field to the app schema", () => {
    const post = mapInstagramPostDetails({
      caption: { text: "A caption" },
      carousel_media: [
        { image_versions: { items: [{ url: "https://example.com/carousel.jpg" }] } },
      ],
      code: "ABC123",
      comment_count: 12,
      image_versions: {
        additional_items: {
          first_frame: { url: "https://example.com/frame.jpg" },
        },
        items: [{ url: "https://example.com/cover.jpg" }],
      },
      is_video: true,
      like_count: 45,
      metrics: {
        play_count: 67,
        save_count: 8,
        share_count: 9,
      },
      taken_at_date: "2026-08-20T10:00:00+00:00",
      thumbnail_url: "https://example.com/thumbnail.jpg",
      video_duration: 12.6,
      video_url: "https://example.com/video.mp4",
    });

    expect(post).toEqual({
      uploaded_at: "2026-08-20T10:00:00.000Z",
      thumbnail_url: "https://example.com/thumbnail.jpg",
      post_url: "https://www.instagram.com/reel/ABC123/",
      first_frame_url: "https://example.com/frame.jpg",
      video_embed_url: "https://example.com/video.mp4",
      media_type: "carousel",
      carousel_image_urls: ["https://example.com/carousel.jpg"],
      video_length_secs: 13,
      view_count: 67,
      save_count: 8,
      share_count: 9,
      comment_count: 12,
      like_count: 45,
      description: "A caption",
    });
  });

  it("prefers additional_items.first_frame over image_versions.items", () => {
    expect(
      mapInstagramPostDetails({
        code: "ABC123",
        is_video: true,
        taken_at_date: "2026-08-20T10:00:00+00:00",
        image_versions: {
          additional_items: {
            first_frame: [{ url: "https://example.com/first-frame.jpg" }],
          },
          items: [{ url: "https://example.com/cover.jpg" }],
        },
      }),
    ).toMatchObject({
      first_frame_url: "https://example.com/first-frame.jpg",
    });
  });

  it("accepts a null caption from Apify output", () => {
    expect(
      mapInstagramPostDetails({
        code: "DLcNbiWM15K",
        product_type: "clips",
        is_video: true,
        taken_at_date: "2025-06-28T10:16:23+00:00",
        caption: null,
        thumbnail_url: "https://example.com/thumbnail.jpg",
      }),
    ).toMatchObject({
      post_url: "https://www.instagram.com/reel/DLcNbiWM15K/",
      description: null,
    });
  });

  it("keeps the listing URL out of detail updates", () => {
    const details = mapInstagramPostDetails({
      code: "ABC123",
      is_video: true,
      taken_at_date: "2026-08-20T10:00:00+00:00",
    });

    expect(details).not.toBeNull();
    expect(toInstagramPostDetailsUpdate(details!)).not.toHaveProperty("post_url");
  });
});

describe("mapInstagramDetailsProfile", () => {
  it("uses the highest-resolution profile image and profile metadata", () => {
    expect(
      mapInstagramDetailsProfile({
        code: "ABC123",
        taken_at: 1_786_968_000,
        user: {
          biography: "Profile bio",
          full_name: "Velocity",
          profile_pic_url: "https://example.com/profile.jpg",
          profile_pic_url_hd: "https://example.com/profile-hd.jpg",
        },
      }),
    ).toEqual({
      description: "Profile bio",
      ig_name: "Velocity",
      profile_picture_url: "https://example.com/profile-hd.jpg",
    });
  });
});
