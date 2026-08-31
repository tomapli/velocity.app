import { describe, expect, it } from "vitest";

import {
  getMetaScrapeRetryDelaySeconds,
  META_SCRAPE_RETRY_BASE_DELAY_SECONDS,
  META_SCRAPE_RETRY_MAX_DELAY_SECONDS,
} from "@/lib/meta/scrape-retry";

describe("getMetaScrapeRetryDelaySeconds", () => {
  it("doubles from the base delay on every failed delivery", () => {
    expect(getMetaScrapeRetryDelaySeconds(1)).toBe(
      META_SCRAPE_RETRY_BASE_DELAY_SECONDS,
    );
    expect(getMetaScrapeRetryDelaySeconds(2)).toBe(
      META_SCRAPE_RETRY_BASE_DELAY_SECONDS * 2,
    );
    expect(getMetaScrapeRetryDelaySeconds(4)).toBe(
      META_SCRAPE_RETRY_BASE_DELAY_SECONDS * 8,
    );
  });

  it("caps the delay and tolerates unexpected delivery counts", () => {
    expect(getMetaScrapeRetryDelaySeconds(20)).toBe(
      META_SCRAPE_RETRY_MAX_DELAY_SECONDS,
    );
    expect(getMetaScrapeRetryDelaySeconds(0)).toBe(
      META_SCRAPE_RETRY_BASE_DELAY_SECONDS,
    );
  });
});
