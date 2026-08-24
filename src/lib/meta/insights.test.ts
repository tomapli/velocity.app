import { describe, expect, it } from "vitest";

import { getMissingInsightMetrics } from "@/lib/meta/insights";

describe("getMissingInsightMetrics", () => {
  it("finds metrics silently omitted from a partial Meta response", () => {
    expect(
      getMissingInsightMetrics(
        ["views", "reach", "saved", "shares", "follows"],
        [
          { name: "reach", period: "lifetime", values: [{ value: 512 }] },
          { name: "follows", period: "lifetime", values: [{ value: 0 }] },
        ],
      ),
    ).toEqual(["views", "saved", "shares"]);
  });

  it("returns no work for a complete Meta response", () => {
    expect(
      getMissingInsightMetrics(
        ["views", "saved"],
        [{ name: "views" }, { name: "saved" }],
      ),
    ).toEqual([]);
  });
});
