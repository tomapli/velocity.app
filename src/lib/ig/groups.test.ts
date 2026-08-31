import { describe, expect, it } from "vitest";

import {
  buildIgScrapeJobs,
  getIgScrapeJobProgress,
  getIgScrapeJobStatus,
  getJobRequestedPostCount,
} from "@/lib/ig/groups";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";

const PROFILE: IgProfile = {
  created_at: "2026-08-20T09:00:00.000Z",
  created_by: "e1000000-0000-4000-8000-000000000002",
  description: null,
  id: "e1000000-0000-4000-8000-000000000001",
  ig_name: null,
  ig_username: "velocity",
  note: null,
  post_count: null,
  follower_count: null,
  profile_picture_url: null,
  updated_at: "2026-08-20T09:00:00.000Z",
};

const GROUP: Group = {
  created_at: "2026-08-20T10:00:00.000Z",
  created_by: "e1000000-0000-4000-8000-000000000002",
  id: "e1000000-0000-4000-8000-000000000003",
  ig_profile_id: PROFILE.id,
  requested_post_count: 24,
  since_when: null,
  data_source: "public",
  scrape_method: "apify_instagram_scraper",
  meta_connection_id: null,
  meta_instagram_account_id: null,
};

const SCRAPE: ScheduledScrape = {
  apify_called_at: null,
  apify_run_id: null,
  created_at: "2026-08-20T10:00:01.000Z",
  error_message: null,
  finished_at: null,
  group_id: GROUP.id,
  id: "e1000000-0000-4000-8000-000000000004",
  scrape_type: "posts",
  state: {},
  updated_at: "2026-08-20T10:00:01.000Z",
};

describe("profile posts scrapes", () => {
  const PROFILE_POSTS_GROUP: Group = {
    ...GROUP,
    scrape_method: "data_slayer_instagram_posts",
  };
  const PROFILE_POSTS_SCRAPE: ScheduledScrape = {
    ...SCRAPE,
    scrape_type: "profile_posts",
    apify_called_at: "2026-08-20T10:00:02.000Z",
  };

  it("expects a single listing request and no details batches", () => {
    const [job] = buildIgScrapeJobs(
      [PROFILE_POSTS_GROUP],
      [PROFILE_POSTS_SCRAPE],
      new Map([[PROFILE.id, PROFILE]]),
    );

    expect(getIgScrapeJobStatus(job!)).toBe("scraping");
    expect(getIgScrapeJobProgress(job!)).toEqual({
      finished: 0,
      expectedTotal: 1,
      percent: 0,
    });
  });

  it("is ready once the profile posts request finishes", () => {
    const [job] = buildIgScrapeJobs(
      [PROFILE_POSTS_GROUP],
      [{ ...PROFILE_POSTS_SCRAPE, finished_at: "2026-08-20T10:03:00.000Z" }],
      new Map([[PROFILE.id, PROFILE]]),
    );

    expect(getIgScrapeJobStatus(job!)).toBe("ready");
    expect(getIgScrapeJobProgress(job!).percent).toBe(100);
  });

  it("fails when the only listing request failed", () => {
    const [job] = buildIgScrapeJobs(
      [PROFILE_POSTS_GROUP],
      [
        {
          ...PROFILE_POSTS_SCRAPE,
          finished_at: "2026-08-20T10:03:00.000Z",
          error_message: "Apify run failed",
        },
      ],
      new Map([[PROFILE.id, PROFILE]]),
    );

    expect(getIgScrapeJobStatus(job!)).toBe("error");
  });
});

describe("buildIgScrapeJobs", () => {
  it("uses groups as the scrape-history rows", () => {
    const [job] = buildIgScrapeJobs(
      [GROUP],
      [],
      new Map([[PROFILE.id, PROFILE]]),
    );

    expect(job?.group).toEqual(GROUP);
    expect(job?.scrapes).toEqual([]);
    expect(getIgScrapeJobStatus(job!)).toBe("waiting");
    expect(getJobRequestedPostCount(job!)).toBe(24);
  });

  it("attaches only scheduled runs that reference the group", () => {
    const [job] = buildIgScrapeJobs(
      [GROUP],
      [SCRAPE],
      new Map([[PROFILE.id, PROFILE]]),
    );

    expect(job?.scrapes).toEqual([SCRAPE]);
  });

  it("estimates progress from the expected listings and details batches", () => {
    const finishedPosts = { ...SCRAPE, finished_at: "2026-08-20T10:03:00.000Z" };
    const runningReels = {
      ...SCRAPE,
      id: "e1000000-0000-4000-8000-000000000005",
      scrape_type: "reels" as const,
      apify_called_at: "2026-08-20T10:00:02.000Z",
    };

    // 24 requested posts → 2 listings + 1 details batch expected.
    expect(getIgScrapeJobProgress({ group: GROUP, profile: PROFILE, scrapes: [] })).toEqual({
      finished: 0,
      expectedTotal: 3,
      percent: 0,
    });
    expect(
      getIgScrapeJobProgress({
        group: GROUP,
        profile: PROFILE,
        scrapes: [finishedPosts, runningReels],
      }),
    ).toEqual({ finished: 1, expectedTotal: 3, percent: 33 });
    expect(
      getIgScrapeJobProgress({
        group: { ...GROUP, requested_post_count: 250 },
        profile: PROFILE,
        scrapes: [finishedPosts, { ...runningReels, finished_at: "2026-08-20T10:04:00.000Z" }],
      }),
    ).toEqual({ finished: 2, expectedTotal: 5, percent: 100 });
  });

  it("surfaces a failed Meta enrichment step", () => {
    const job = {
      group: GROUP,
      profile: PROFILE,
      scrapes: [
        {
          ...SCRAPE,
          scrape_type: "meta" as const,
          finished_at: "2026-08-20T10:01:00.000Z",
          error_message: "Meta API unavailable",
        },
      ],
    };

    expect(getIgScrapeJobStatus(job)).toBe("error");
  });
});
