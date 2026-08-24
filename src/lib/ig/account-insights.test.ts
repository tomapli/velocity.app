import { describe, expect, it } from "vitest";

import { summarizeAccountInsights } from "@/lib/ig/account-insights";

describe("summarizeAccountInsights", () => {
  it("shows every requested metric and keeps unavailable values explicit", () => {
    const summaries = summarizeAccountInsights({
      views: [
        {
          name: "views",
          values: [
            { end_time: "2026-08-23T00:00:00Z", value: 120 },
            { end_time: "2026-08-24T00:00:00Z", value: 180 },
          ],
        },
      ],
      follows_and_unfollows: [
        { values: [{ value: { follows: 8, unfollows: 2 } }] },
      ],
    });

    expect(summaries).toHaveLength(20);
    expect(summaries.find((summary) => summary.metric === "views")).toMatchObject({
      displayValue: "180",
      numericValue: 180,
      points: [{ timestamp: "2026-08-23T00:00:00Z", value: 120 }, { timestamp: "2026-08-24T00:00:00Z", value: 180 }],
    });
    expect(
      summaries.find((summary) => summary.metric === "profile_views")?.displayValue,
    ).toBe("Not provided");
  });
});

