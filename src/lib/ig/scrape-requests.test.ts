import { describe, expect, it } from "vitest";

import type { ScheduledScrape } from "@/lib/ig/queries";
import {
  getMetaScrapeState,
  getScheduledScrapeErrorMessage,
  getScheduledScrapeProgress,
  getScheduledScrapeStatus,
  getScrapeDataOrigin,
} from "@/lib/ig/scrape-requests";
import { getMetaAccountInsightSteps } from "@/lib/meta/insights";
import {
  createInitialMetaScrapeState,
  toMetaScrapeStateJson,
} from "@/lib/meta/scrape-state";

const CREATED_AT = "2026-08-20T10:00:01.000Z";

const BASE: ScheduledScrape = {
  apify_called_at: null,
  apify_run_id: null,
  created_at: CREATED_AT,
  error_message: null,
  finished_at: null,
  group_id: "e1000000-0000-4000-8000-000000000003",
  id: "e1000000-0000-4000-8000-000000000004",
  scrape_type: "posts",
  state: {},
  updated_at: CREATED_AT,
};

function metaScrape(
  overrides: Partial<ReturnType<typeof createInitialMetaScrapeState>>,
  row: Partial<ScheduledScrape> = {},
): ScheduledScrape {
  return {
    ...BASE,
    scrape_type: "meta",
    state: toMetaScrapeStateJson({
      ...createInitialMetaScrapeState(new Date(CREATED_AT)),
      ...overrides,
    }),
    ...row,
  };
}

describe("getScheduledScrapeStatus", () => {
  it("treats Apify requests as queued until a run is called", () => {
    expect(getScheduledScrapeStatus(BASE)).toBe("queued");
    expect(
      getScheduledScrapeStatus({
        ...BASE,
        apify_called_at: "2026-08-20T10:00:05.000Z",
        apify_run_id: "run-1",
      }),
    ).toBe("running");
  });

  it("distinguishes finished from failed requests", () => {
    const finishedAt = "2026-08-20T10:05:00.000Z";
    expect(getScheduledScrapeStatus({ ...BASE, finished_at: finishedAt })).toBe("done");
    expect(
      getScheduledScrapeStatus({
        ...BASE,
        finished_at: finishedAt,
        error_message: "Apify run failed",
      }),
    ).toBe("failed");
  });

  it("marks Meta requests running once the pipeline persisted a step", () => {
    expect(getScheduledScrapeStatus(metaScrape({}))).toBe("queued");
    expect(getScheduledScrapeStatus(metaScrape({ processed_media_count: 5 }))).toBe(
      "running",
    );
    expect(getScheduledScrapeStatus(metaScrape({ phase: "profile" }))).toBe("running");
    expect(
      getScheduledScrapeStatus(
        metaScrape({}, { updated_at: "2026-08-20T10:00:09.000Z" }),
      ),
    ).toBe("running");
  });
});

describe("getScheduledScrapeProgress", () => {
  it("counts the posts in a details batch", () => {
    const progress = getScheduledScrapeProgress({
      ...BASE,
      scrape_type: "post_details",
      state: { postUrls: ["https://www.instagram.com/p/a/", "https://www.instagram.com/p/b/"] },
    });

    expect(progress).toEqual({ label: "2 posts in this batch", percent: null });
  });

  it("reports Meta account-insight steps against the known total", () => {
    const total = getMetaAccountInsightSteps().length;
    const progress = getScheduledScrapeProgress(
      metaScrape({ phase: "account_insights", account_metric_index: 3 }),
    );

    expect(progress?.label).toBe(`Collecting account insights · 3/${total}`);
    expect(progress?.percent).toBe(Math.round(((2 + 3) / (2 + total)) * 100));
  });

  it("has no per-request progress for listings", () => {
    expect(getScheduledScrapeProgress(BASE)).toBeNull();
    expect(getScrapeDataOrigin(BASE)).toBe("public");
    expect(getScrapeDataOrigin(metaScrape({}))).toBe("private");
  });
});

describe("getScheduledScrapeErrorMessage", () => {
  it("surfaces transient Meta retry errors before the row is finished", () => {
    const scrape = metaScrape({ attempts: 2, last_error: "Rate limited" });

    expect(getMetaScrapeState(scrape)?.attempts).toBe(2);
    expect(getScheduledScrapeErrorMessage(scrape)).toBe("Rate limited");
    expect(getScheduledScrapeStatus(scrape)).toBe("running");
  });
});
