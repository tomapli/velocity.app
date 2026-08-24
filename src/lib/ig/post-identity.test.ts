import { describe, expect, it } from "vitest";

import { deduplicateIgPostsByShortcode } from "@/lib/ig/post-identity";

const PROFILE_ID = "e1000000-0000-4000-8000-000000000001";

interface TestPost {
  id: string;
  ig_profile_id: string;
  post_url: string;
}

function post(id: string, postUrl: string, profileId = PROFILE_ID): TestPost {
  return {
    id,
    ig_profile_id: profileId,
    post_url: postUrl,
  };
}

describe("deduplicateIgPostsByShortcode", () => {
  it("treats /p and /reel URLs with the same shortcode as one post", () => {
    const posts = deduplicateIgPostsByShortcode([
      post("reel", "https://www.instagram.com/reel/ABC123/"),
      post("post", "https://www.instagram.com/p/ABC123/"),
    ]);

    expect(posts).toEqual([
      post("post", "https://www.instagram.com/p/ABC123/"),
    ]);
  });

  it("keeps different shortcodes and profiles separate", () => {
    const otherProfileId = "e1000000-0000-4000-8000-000000000002";
    const posts = deduplicateIgPostsByShortcode([
      post("first", "https://www.instagram.com/p/ABC123/"),
      post("second", "https://www.instagram.com/reel/DEF456/"),
      post("other-profile", "https://www.instagram.com/reel/ABC123/", otherProfileId),
    ]);

    expect(posts.map((item) => item.id)).toEqual([
      "first",
      "second",
      "other-profile",
    ]);
  });
});
