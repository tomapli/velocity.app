import { describe, expect, it } from "vitest";

import { shouldContinueDetails } from "@/lib/ig/start-runs";

describe("shouldContinueDetails", () => {
  it("continues while pending URLs remain under the requested maximum", () => {
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 100,
        requestedPostCount: 240,
        batchHadOlderPost: false,
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
      }),
    ).toBe(false);
    expect(
      shouldContinueDetails({
        pendingUrlCount: 40,
        detailedPostCount: 100,
        requestedPostCount: null,
        batchHadOlderPost: true,
      }),
    ).toBe(false);
    expect(
      shouldContinueDetails({
        pendingUrlCount: 0,
        detailedPostCount: 12,
        requestedPostCount: null,
        batchHadOlderPost: false,
      }),
    ).toBe(false);
  });
});
