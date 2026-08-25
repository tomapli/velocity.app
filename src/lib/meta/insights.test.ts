import { describe, expect, it } from "vitest";

import { META_ACCOUNT_INSIGHT_METRICS } from "@/lib/meta/constants";
import {
  getMetaAccountInsightRequests,
  getMissingInsightMetrics,
} from "@/lib/meta/insights";

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

describe("getMetaAccountInsightRequests", () => {
  const since = 1_700_000_000;
  const until = 1_707_776_000;

  it("covers the complete current Instagram account-insight metric set", () => {
    expect(META_ACCOUNT_INSIGHT_METRICS).toEqual([
      "views",
      "reach",
      "accounts_engaged",
      "total_interactions",
      "likes",
      "comments",
      "shares",
      "saves",
      "replies",
      "reposts",
      "follows_and_unfollows",
      "profile_links_taps",
      "follower_demographics",
      "engaged_audience_demographics",
    ]);
  });

  it("requests totals and every supported reach breakdown plus its time series", () => {
    expect(getMetaAccountInsightRequests("reach", since, until)).toEqual([
      {
        key: "total",
        query: {
          period: "day",
          since: String(since),
          until: String(until),
          metric_type: "total_value",
        },
      },
      {
        key: "time_series",
        query: {
          period: "day",
          since: String(since),
          until: String(until),
          metric_type: "time_series",
        },
      },
      {
        key: "breakdown_media_product_type",
        query: {
          period: "day",
          since: String(since),
          until: String(until),
          metric_type: "total_value",
          breakdown: "media_product_type",
        },
      },
      {
        key: "breakdown_follower_type",
        query: {
          period: "day",
          since: String(since),
          until: String(until),
          metric_type: "total_value",
          breakdown: "follow_type",
        },
      },
    ]);
  });

  it("uses total-value follower and media breakdowns for views", () => {
    const requests = getMetaAccountInsightRequests("views", since, until);

    expect(requests.map((request) => request.key)).toEqual([
      "total",
      "breakdown_media_product_type",
      "breakdown_follower_type",
    ]);
    expect(requests.at(-1)?.query.breakdown).toBe("follower_type");
    expect(
      requests.every((request) => request.query.metric_type === "total_value"),
    ).toBe(true);
  });

  it("requests every current demographic timeframe and dimension", () => {
    const requests = getMetaAccountInsightRequests(
      "follower_demographics",
      since,
      until,
    );

    expect(requests).toHaveLength(8);
    expect(new Set(requests.map((request) => request.query.timeframe))).toEqual(
      new Set(["this_month", "this_week"]),
    );
    expect(new Set(requests.map((request) => request.query.breakdown))).toEqual(
      new Set(["age", "gender", "city", "country"]),
    );
    expect(
      requests.every(
        (request) =>
          request.query.period === "lifetime" &&
          request.query.metric_type === "total_value" &&
          request.query.since == null &&
          request.query.until == null,
      ),
    ).toBe(true);
  });

  it("requests the metric-specific action breakdowns", () => {
    expect(
      getMetaAccountInsightRequests(
        "follows_and_unfollows",
        since,
        until,
      ).at(-1)?.query.breakdown,
    ).toBe("follow_type");
    expect(
      getMetaAccountInsightRequests("profile_links_taps", since, until).at(-1)
        ?.query.breakdown,
    ).toBe("contact_button_type");
  });

  it("requests media-product breakdowns only for compatible interactions", () => {
    for (const metric of [
      "comments",
      "likes",
      "saves",
      "shares",
      "total_interactions",
    ] as const) {
      expect(
        getMetaAccountInsightRequests(metric, since, until).some(
          (request) => request.query.breakdown === "media_product_type",
        ),
      ).toBe(true);
    }

    for (const metric of [
      "accounts_engaged",
      "replies",
      "reposts",
    ] as const) {
      expect(getMetaAccountInsightRequests(metric, since, until)).toHaveLength(
        1,
      );
    }
  });
});
