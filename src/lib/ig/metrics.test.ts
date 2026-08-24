import { describe, expect, it } from "vitest";

import type { IgPost } from "@/lib/ig/queries";
import {
  filterIgPostsByMediaType,
  getIgPostMetrics,
  postsToCsv,
  sortIgPosts,
} from "@/lib/ig/metrics";

function post(overrides: Partial<IgPost> = {}): IgPost {
  return {
    id: "e1000000-0000-4000-8000-000000000001",
    ig_profile_id: "e1000000-0000-4000-8000-000000000002",
    source_scrape_id: "e1000000-0000-4000-8000-000000000003",
    details_scrape_id: "e1000000-0000-4000-8000-000000000004",
    uploaded_at: "2026-08-20T10:00:00.000Z",
    thumbnail_url: "https://example.com/thumb.jpg",
    post_url: "https://www.instagram.com/p/ABC/",
    first_frame_url: "https://example.com/frame.jpg",
    video_embed_url: "https://example.com/video.mp4",
    media_type: "short",
    carousel_image_urls: null,
    video_length_secs: 18,
    view_count: 1000,
    save_count: 40,
    share_count: 30,
    comment_count: 20,
    like_count: 100,
    meta_media_id: null,
    follows_count: null,
    follower_view_count: null,
    non_follower_view_count: null,
    follower_non_follower_ratio: null,
    reach_count: null,
    hook_rate: null,
    average_watch_time_ms: null,
    hold_rate: null,
    description: "A caption",
    created_at: "2026-08-20T11:00:00.000Z",
    ...overrides,
  };
}

describe("getIgPostMetrics", () => {
  it("computes weighted ER from the documented formula and omits rates when views are zero", () => {
    const metrics = getIgPostMetrics(post());

    expect(metrics.weightedEr?.value).toBe(39);
    expect(metrics.weightedEr?.tone).toBe("pass");
    expect(metrics.unweightedEr?.value).toBe(19);
    expect(metrics.saveRate?.formatted).toBe("4%");
    expect(metrics.videoLength?.tone).toBe("pass");

    const zeroViews = getIgPostMetrics(post({ view_count: 0 }));
    expect(zeroViews.weightedEr).toBeNull();
    expect(zeroViews.saveRate).toBeNull();
  });

  it("omits rates when the source count is missing", () => {
    const metrics = getIgPostMetrics(
      post({ save_count: null, share_count: null, comment_count: null, like_count: null }),
    );

    expect(metrics.saveRate).toBeNull();
    expect(metrics.unweightedEr).toBeNull();
    expect(metrics.descriptionLength).toBe(9);
  });

  it("marks description length against the 300–700 target", () => {
    expect(getIgPostMetrics(post({ description: "short" })).descriptionLengthScore?.tone).toBe(
      "miss",
    );
    expect(
      getIgPostMetrics(post({ description: "x".repeat(400) })).descriptionLengthScore?.tone,
    ).toBe("pass");
  });
});

describe("sortIgPosts and filterIgPostsByMediaType", () => {
  it("sorts by weighted ER and keeps omitted values last", () => {
    const low = post({ id: "a", view_count: 1000, save_count: 1, share_count: 0, comment_count: 0, like_count: 0 });
    const high = post({ id: "b", view_count: 100, save_count: 10, share_count: 0, comment_count: 0, like_count: 0 });
    const omitted = post({ id: "c", view_count: 0 });

    expect(sortIgPosts([low, omitted, high], "weighted_er", "desc").map((row) => row.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("filters to selected media types", () => {
    const posts = [
      post({ id: "a", media_type: "short" }),
      post({ id: "b", media_type: "static" }),
      post({ id: "c", media_type: "carousel" }),
    ];

    expect(filterIgPostsByMediaType(posts, ["static", "carousel"]).map((row) => row.id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterIgPostsByMediaType(posts, []).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("postsToCsv", () => {
  it("quotes description text that contains commas", () => {
    const csv = postsToCsv([post({ description: "hello, world" })]);
    expect(csv).toContain('"hello, world"');
    expect(csv.split("\n")).toHaveLength(2);
  });
});
