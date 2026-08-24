import { describe, expect, it } from "vitest";

import {
  buildIgScrapeJobs,
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
  updated_at: "2026-08-20T10:00:01.000Z",
};

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
});
