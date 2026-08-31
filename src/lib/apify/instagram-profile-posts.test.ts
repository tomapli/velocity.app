import { describe, expect, it } from "vitest";

import {
  buildInstagramProfilePostsInput,
  getProfilePostsMaxPages,
  mapInstagramProfilePosts,
  toProfilePostRow,
} from "@/lib/apify/instagram-profile-posts";

function item(code: string, takenAtDate: string, extra: Record<string, unknown> = {}) {
  return {
    code,
    taken_at_date: takenAtDate,
    like_count: 10,
    comment_count: 2,
    share_count: 1,
    caption: { text: `Post ${code}` },
    user: { username: "velocity" },
    thumbnail_url: `https://cdn.example.com/${code}.jpg`,
    ...extra,
  };
}

describe("getProfilePostsMaxPages", () => {
  it("converts the requested post count into 12-post pages", () => {
    expect(getProfilePostsMaxPages(12, null)).toBe(1);
    expect(getProfilePostsMaxPages(13, null)).toBe(2);
    expect(getProfilePostsMaxPages(500, null)).toBe(42);
  });

  it("fetches the maximum when only a start date is given or nothing is set", () => {
    expect(getProfilePostsMaxPages(null, "2026-01-01T00:00:00.000Z")).toBe(42);
    expect(getProfilePostsMaxPages(null, null)).toBe(42);
  });

  it("never requests fewer than one page", () => {
    expect(getProfilePostsMaxPages(1, null)).toBe(1);
    expect(buildInstagramProfilePostsInput({
      username: "velocity",
      requestedPostCount: 1,
      sinceWhen: null,
    })).toEqual({ username: "velocity", maxPages: 1 });
  });
});

describe("mapInstagramProfilePosts", () => {
  const dataset = [
    item("older", "2026-01-05T10:00:00+00:00"),
    item("newest", "2026-03-01T10:00:00+00:00", { is_video: true, play_count: 900 }),
    item("newest", "2026-03-01T10:00:00+00:00"),
    item("middle", "2026-02-01T10:00:00+00:00"),
    { not: "a post" },
  ];

  it("dedupes by canonical URL, sorts newest first, and caps to the requested count", () => {
    const posts = mapInstagramProfilePosts(dataset, {
      requestedPostCount: 2,
      sinceWhen: null,
    });

    expect(posts.map((post) => post.post_url)).toEqual([
      "https://www.instagram.com/p/newest/",
      "https://www.instagram.com/p/middle/",
    ]);
    expect(posts[0]).toMatchObject({
      media_type: "short",
      view_count: 900,
      like_count: 10,
      description: "Post newest",
    });
  });

  it("drops posts older than the start date instead of truncating", () => {
    const posts = mapInstagramProfilePosts(dataset, {
      requestedPostCount: null,
      sinceWhen: "2026-01-15T00:00:00.000Z",
    });

    expect(posts.map((post) => post.post_url)).toEqual([
      "https://www.instagram.com/p/newest/",
      "https://www.instagram.com/p/middle/",
    ]);
  });
});

describe("toProfilePostRow", () => {
  it("marks the run as both the listing and the details source", () => {
    const [post] = mapInstagramProfilePosts([item("abc", "2026-03-01T10:00:00+00:00")], {
      requestedPostCount: null,
      sinceWhen: null,
    });

    expect(toProfilePostRow("profile-1", "scrape-1", post!)).toMatchObject({
      ig_profile_id: "profile-1",
      source_scrape_id: "scrape-1",
      details_scrape_id: "scrape-1",
      post_url: "https://www.instagram.com/p/abc/",
      uploaded_at: "2026-03-01T10:00:00.000Z",
    });
  });
});
