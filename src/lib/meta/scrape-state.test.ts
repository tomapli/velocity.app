import { describe, expect, it } from "vitest";

import {
  createInitialMetaScrapeState,
  createMetaInsightsRefreshState,
  getMetaScrapeStepKey,
  parseMetaScrapeState,
} from "@/lib/meta/scrape-state";

describe("Meta scrape state", () => {
  it("creates a resumable 180-day starting window", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    const state = createInitialMetaScrapeState(now);

    expect(state).toMatchObject({
      phase: "media",
      media_cursor: null,
      processed_media_count: 0,
      account_metric_index: 0,
      attempts: 0,
      last_error: null,
      period_end: now.toISOString(),
    });
    expect(state.run_id).not.toBe("");
    expect(Date.parse(state.period_end) - Date.parse(state.period_start)).toBe(
      180 * 24 * 60 * 60 * 1_000,
    );
    expect(parseMetaScrapeState(state)).toEqual(state);
  });

  it("starts a page-open refresh at the profile phase with a fresh run", () => {
    const first = createMetaInsightsRefreshState();
    const second = createMetaInsightsRefreshState();

    expect(first.phase).toBe("profile");
    expect(first.account_metric_index).toBe(0);
    expect(first.run_id).not.toBe(second.run_id);
  });

  it("scopes the queue idempotency key to the run and durable step", () => {
    const state = { ...createInitialMetaScrapeState(), run_id: "run-9" };

    expect(getMetaScrapeStepKey("scrape-1", state)).toBe(
      "scrape-1:run-9:media:first",
    );
    expect(
      getMetaScrapeStepKey("scrape-1", {
        ...state,
        phase: "account_insights",
        account_metric_index: 4,
      }),
    ).toBe("scrape-1:run-9:account:4");
  });

  it("keeps pre-run states parseable and on their historic key format", () => {
    const persisted = createInitialMetaScrapeState();
    const { run_id: _runId, ...legacy } = persisted;

    const parsed = parseMetaScrapeState(legacy);
    expect(parsed.run_id).toBe("");
    expect(getMetaScrapeStepKey("scrape-1", parsed)).toBe("scrape-1:media:first");
  });

  it("rejects incomplete or malformed persisted state", () => {
    expect(() => parseMetaScrapeState({ phase: "media" })).toThrow();
  });
});
