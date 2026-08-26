import { describe, expect, it } from "vitest";

import {
  META_ACCOUNT_INSIGHT_METRICS,
  META_ACCOUNT_INSIGHT_RANGES_DAYS,
  META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
  META_FOLLOWER_COUNT_MAX_RANGE_DAYS,
} from "@/lib/meta/constants";
import {
  getMetaAccountInsightRequests,
  getMetaAccountInsightSteps,
  getMetaAccountInsightWindowedRequests,
  getMissingInsightMetrics,
  splitMetaInsightWindow,
} from "@/lib/meta/insights";

const SECONDS_PER_DAY = 24 * 60 * 60;

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
      "online_followers",
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

  it("requests the trailing-month hourly series for online_followers", () => {
    const wideSince = until - 180 * SECONDS_PER_DAY;
    expect(
      getMetaAccountInsightRequests("online_followers", wideSince, until),
    ).toEqual([
      {
        key: "time_series",
        query: {
          period: "lifetime",
          since: String(until - 30 * SECONDS_PER_DAY),
          until: String(until),
        },
      },
    ]);
  });

  it("requests the legacy day series for follower_count", () => {
    expect(getMetaAccountInsightRequests("follower_count", since, until)).toEqual([
      {
        key: "time_series",
        query: { period: "day", since: String(since), until: String(until) },
      },
    ]);
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

describe("splitMetaInsightWindow", () => {
  const until = 1_707_776_000;

  it("keeps a range at the Meta maximum as a single window", () => {
    const since = until - 30 * SECONDS_PER_DAY;
    expect(splitMetaInsightWindow(since, until)).toEqual([{ since, until }]);
  });

  it("chunks longer ranges into covering windows, oldest first", () => {
    const since = until - 180 * SECONDS_PER_DAY;
    const windows = splitMetaInsightWindow(since, until);

    expect(windows).toHaveLength(6);
    expect(windows[0]?.since).toBe(since);
    expect(windows.at(-1)?.until).toBe(until);
    for (let index = 1; index < windows.length; index += 1) {
      expect(windows[index]?.since).toBe(windows[index - 1]?.until);
    }
    expect(
      windows.every(
        (window) => window.until - window.since <= 30 * SECONDS_PER_DAY,
      ),
    ).toBe(true);
  });
});

describe("getMetaAccountInsightWindowedRequests", () => {
  const until = 1_707_776_000;

  it("keeps historic un-suffixed keys for single-window ranges", () => {
    const since = until - 15 * SECONDS_PER_DAY;
    expect(
      getMetaAccountInsightWindowedRequests("likes", since, until).map(
        (request) => request.key,
      ),
    ).toEqual(["total", "breakdown_media_product_type"]);
  });

  it("suffixes every window's requests for chunked ranges", () => {
    const since = until - 90 * SECONDS_PER_DAY;
    const requests = getMetaAccountInsightWindowedRequests("likes", since, until);

    expect(requests.map((request) => request.key)).toEqual([
      "total_0",
      "breakdown_media_product_type_0",
      "total_1",
      "breakdown_media_product_type_1",
      "total_2",
      "breakdown_media_product_type_2",
    ]);
    expect(new Set(requests.map((request) => request.query.since)).size).toBe(3);
  });

  it("never chunks range-independent demographics", () => {
    const since = until - 180 * SECONDS_PER_DAY;
    expect(
      getMetaAccountInsightWindowedRequests("follower_demographics", since, until),
    ).toHaveLength(8);
  });
});

describe("getMetaAccountInsightSteps", () => {
  const steps = getMetaAccountInsightSteps();

  it("fills the default range first so the default view lands earliest", () => {
    expect(steps[0]?.rangeDays).toBe(META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS);
    const rangeOrder = [...new Set(steps.map((step) => step.rangeDays))];
    expect(rangeOrder).toEqual(
      [...META_ACCOUNT_INSIGHT_RANGES_DAYS].sort((left, right) => right - left),
    );
  });

  it("covers every metric for every range except the special cases", () => {
    for (const rangeDays of META_ACCOUNT_INSIGHT_RANGES_DAYS) {
      const metrics = steps
        .filter((step) => step.rangeDays === rangeDays)
        .map((step) => step.metric);
      for (const metric of META_ACCOUNT_INSIGHT_METRICS) {
        if (metric.endsWith("_demographics") || metric === "online_followers") {
          // Range-independent metrics are fetched once, on the default range.
          expect(metrics.includes(metric)).toBe(
            rangeDays === META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
          );
        } else {
          expect(metrics).toContain(metric);
        }
      }
      // Meta only serves the follower day series for the trailing month.
      expect(metrics.includes("follower_count")).toBe(
        rangeDays <= META_FOLLOWER_COUNT_MAX_RANGE_DAYS,
      );
    }
  });
});
