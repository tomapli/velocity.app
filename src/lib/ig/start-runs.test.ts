import { describe, expect, it } from "vitest";

import {
  getAttemptedDetailsShortcodes,
  selectPendingDetailsPosts,
  shouldContinueDetails,
} from "@/lib/ig/start-runs";
import type { Tables } from "@/lib/supabase/tables";

type ScheduledScrape = Tables<"scheduled_scrapes">;

const BASE_SCRAPE: ScheduledScrape = {
  apify_called_at: null,
  apify_run_id: null,
  created_at: "2026-08-26T12:00:00.000Z",
  error_message: null,
  finished_at: "2026-08-26T12:01:00.000Z",
  group_id: "e1000000-0000-4000-8000-000000000003",
  id: "e1000000-0000-4000-8000-000000000004",
  scrape_type: "post_details",
  state: {},
  updated_at: "2026-08-26T12:01:00.000Z",
};

describe("shouldContinueDetails", () => {
  it("continues while pending URLs remain under the requested maximum", () => {
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 100,
        requestedPostCount: 240,
        batchHadOlderPost: false,
        batchUpdatedCount: 12,
      }),
    ).toBe(true);
  });

  it("stops at the requested maximum, a cutoff post, or an empty queue", () => {
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 240,
        requestedPostCount: 240,
        batchHadOlderPost: false,
        batchUpdatedCount: 12,
      }),
    ).toBe(false);
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 100,
        requestedPostCount: null,
        batchHadOlderPost: true,
        batchUpdatedCount: 12,
      }),
    ).toBe(false);
    expect(
      shouldContinueDetails({
        pendingUrlCount: 0,
        detailedPostCount: 12,
        requestedPostCount: null,
        batchHadOlderPost: false,
        batchUpdatedCount: 12,
      }),
    ).toBe(false);
  });

  it("stops when a batch imports zero posts", () => {
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 100,
        requestedPostCount: 240,
        batchHadOlderPost: false,
        batchUpdatedCount: 0,
      }),
    ).toBe(false);
  });
});

describe("details batch attempts", () => {
  it("does not submit a post twice within one scrape group", () => {
    const attemptedShortcodes = getAttemptedDetailsShortcodes([
      {
        ...BASE_SCRAPE,
        state: {
          postUrls: [
            "https://www.instagram.com/p/already-attempted/",
            "not-an-instagram-url",
          ],
        },
      },
      {
        ...BASE_SCRAPE,
        id: "e1000000-0000-4000-8000-000000000005",
        scrape_type: "posts",
        state: {
          postUrls: ["https://www.instagram.com/p/listing-state-is-ignored/"],
        },
      },
    ]);

    expect(
      selectPendingDetailsPosts(
        [
          {
            id: "post-1",
            post_url: "https://www.instagram.com/p/already-attempted/",
            uploaded_at: "2026-08-26T10:00:00.000Z",
          },
          {
            id: "post-2",
            post_url: "https://www.instagram.com/p/new-post/",
            uploaded_at: "2026-08-26T09:00:00.000Z",
          },
          {
            id: "post-3",
            post_url: "https://www.instagram.com/reel/new-post/",
            uploaded_at: "2026-08-26T09:00:00.000Z",
          },
        ],
        null,
        100,
        attemptedShortcodes,
      ),
    ).toEqual([
      {
        id: "post-2",
        post_url: "https://www.instagram.com/p/new-post/",
        uploaded_at: "2026-08-26T09:00:00.000Z",
      },
    ]);
  });
});
