import { describe, expect, it } from "vitest";

import {
  createInitialMetaScrapeState,
  getMetaScrapeStepKey,
  parseMetaScrapeState,
} from "@/lib/meta/scrape-state";

describe("Meta scrape state", () => {
  it("creates a resumable 90-day starting window", () => {
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
    expect(Date.parse(state.period_end) - Date.parse(state.period_start)).toBe(
      90 * 24 * 60 * 60 * 1_000,
    );
    expect(parseMetaScrapeState(state)).toEqual(state);
  });

  it("uses the durable cursor or metric index as the queue idempotency key", () => {
    const state = createInitialMetaScrapeState();

    expect(getMetaScrapeStepKey("scrape-1", state)).toBe(
      "scrape-1:media:first",
    );
    expect(
      getMetaScrapeStepKey("scrape-1", {
        ...state,
        phase: "account_insights",
        account_metric_index: 4,
      }),
    ).toBe("scrape-1:account:4");
  });

  it("rejects incomplete or malformed persisted state", () => {
    expect(() => parseMetaScrapeState({ phase: "media" })).toThrow();
  });
});
