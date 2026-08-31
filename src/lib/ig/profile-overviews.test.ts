import { describe, expect, it } from "vitest";

import { buildIgProfileOverviews } from "@/lib/ig/profile-overviews";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";

const USER_ID = "e1000000-0000-4000-8000-000000000002";

function profile(id: string, username: string, createdAt: string): IgProfile {
  return {
    created_at: createdAt,
    created_by: USER_ID,
    description: null,
    id,
    ig_name: null,
    ig_username: username,
    note: null,
    post_count: null,
    follower_count: null,
    profile_picture_url: null,
    updated_at: createdAt,
  };
}

function group(id: string, profileId: string, createdAt: string): Group {
  return {
    created_at: createdAt,
    created_by: USER_ID,
    id,
    ig_profile_id: profileId,
    requested_post_count: 12,
    since_when: null,
    data_source: "public",
    meta_connection_id: null,
    meta_instagram_account_id: null,
  };
}

const OLD_PROFILE = profile("p-old", "old", "2026-08-01T10:00:00.000Z");
const NEW_PROFILE = profile("p-new", "new", "2026-08-10T10:00:00.000Z");
const IDLE_PROFILE = profile("p-idle", "idle", "2026-08-05T10:00:00.000Z");

const SCRAPE: ScheduledScrape = {
  apify_called_at: null,
  apify_run_id: null,
  created_at: "2026-08-20T10:00:01.000Z",
  error_message: null,
  finished_at: null,
  group_id: "g-old-2",
  id: "s-1",
  scrape_type: "posts",
  state: {},
  updated_at: "2026-08-20T10:00:01.000Z",
};

describe("buildIgProfileOverviews", () => {
  it("attaches the latest scrape per profile and orders by latest activity", () => {
    const overviews = buildIgProfileOverviews(
      [OLD_PROFILE, NEW_PROFILE, IDLE_PROFILE],
      [
        group("g-old-1", OLD_PROFILE.id, "2026-08-02T10:00:00.000Z"),
        group("g-old-2", OLD_PROFILE.id, "2026-08-20T10:00:00.000Z"),
        group("g-new-1", NEW_PROFILE.id, "2026-08-11T10:00:00.000Z"),
      ],
      [SCRAPE],
    );

    expect(overviews.map((overview) => overview.profile.ig_username)).toEqual([
      "old",
      "new",
      "idle",
    ]);
    expect(overviews[0]?.latestJob?.group.id).toBe("g-old-2");
    expect(overviews[0]?.latestJob?.scrapes).toEqual([SCRAPE]);
    expect(overviews[0]?.scrapeCount).toBe(2);
    expect(overviews[2]?.latestJob).toBeNull();
    expect(overviews[2]?.scrapeCount).toBe(0);
  });
});
