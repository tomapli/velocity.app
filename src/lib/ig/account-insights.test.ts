import { describe, expect, it } from "vitest";

import {
  getAccountInsightSummary,
  getFollowsSplit,
  getOnlineFollowersHeatmap,
  summarizeAccountInsights,
} from "@/lib/ig/account-insights";
import type { Json } from "@/lib/supabase/database.types";

describe("summarizeAccountInsights", () => {
  const summaries = summarizeAccountInsights({
    views: {
      total: [{ name: "views", total_value: { value: 1_234 } }],
      breakdown_media_product_type: [
        {
          name: "views",
          total_value: {
            value: 1_234,
            breakdowns: [
              {
                dimension_keys: ["media_product_type"],
                results: [
                  { dimension_values: ["POST"], value: 200 },
                  { dimension_values: ["REEL"], value: 1_034 },
                ],
              },
            ],
          },
        },
      ],
    },
    reach: {
      total: [{ name: "reach", total_value: { value: 900 } }],
      time_series: [
        {
          name: "reach",
          values: [
            { end_time: "2026-08-24T00:00:00Z", value: 180 },
            { end_time: "2026-08-23T00:00:00Z", value: 120 },
          ],
        },
      ],
    },
    follower_count: {
      time_series: [
        {
          name: "follower_count",
          values: [{ end_time: "2026-08-24T00:00:00Z", value: 5_000 }],
        },
      ],
    },
  });

  it("keeps every summary metric visible and unavailable values explicit", () => {
    expect(summaries).toHaveLength(16);
    expect(
      getAccountInsightSummary(summaries, "profile_links_taps"),
    ).toMatchObject({ total: null, displayValue: "Not provided" });
  });

  it("prefers the range total and sorts breakdown slices largest first", () => {
    expect(getAccountInsightSummary(summaries, "views")).toMatchObject({
      total: 1_234,
      displayValue: "1.2K",
      breakdowns: {
        media_product_type: [
          { label: "Reel", value: 1_034 },
          { label: "Post", value: 200 },
        ],
      },
    });
  });

  it("orders time-series points chronologically", () => {
    expect(getAccountInsightSummary(summaries, "reach")).toMatchObject({
      total: 900,
      points: [
        { timestamp: "2026-08-23T00:00:00Z", value: 120 },
        { timestamp: "2026-08-24T00:00:00Z", value: 180 },
      ],
    });
  });

  it("falls back to the latest point for level metrics without totals", () => {
    expect(getAccountInsightSummary(summaries, "follower_count")).toMatchObject({
      total: 5_000,
      displayValue: "5K",
    });
  });

  it("accepts the plain profile-snapshot follower number", () => {
    const snapshotOnly = summarizeAccountInsights({ follower_count: 4_200 });
    expect(getAccountInsightSummary(snapshotOnly, "follower_count")).toMatchObject(
      { total: 4_200 },
    );
  });

  it("derives signed follower growth from the follow_type breakdown", () => {
    // Meta returns the follows_and_unfollows total request without a value.
    const withGrowth = summarizeAccountInsights({
      follows_and_unfollows: {
        total: [{ name: "follows_and_unfollows", period: "day" }],
        breakdown_follow_type: [
          {
            total_value: {
              breakdowns: [
                {
                  dimension_keys: ["follow_type"],
                  results: [
                    { dimension_values: ["FOLLOWER"], value: 1_460 },
                    { dimension_values: ["NON_FOLLOWER"], value: 185 },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    const summary = getAccountInsightSummary(withGrowth, "follows_and_unfollows");
    expect(summary).toMatchObject({ total: 1_275, displayValue: "+1.3K" });
    expect(getFollowsSplit(summary!.breakdowns)).toEqual({
      follows: 1_460,
      unfollows: 185,
      net: 1_275,
    });
  });

  it("exposes ordered per-window totals and breakdowns for chunked ranges", () => {
    const windowed = summarizeAccountInsights({
      follows_and_unfollows: {
        total_0: [{ name: "follows_and_unfollows" }],
        total_1: [{ name: "follows_and_unfollows" }],
        breakdown_follow_type_0: [
          {
            total_value: {
              breakdowns: [
                { results: [{ dimension_values: ["FOLLOWER"], value: 10 }] },
              ],
            },
          },
        ],
        breakdown_follow_type_1: [
          {
            total_value: {
              breakdowns: [
                { results: [{ dimension_values: ["NON_FOLLOWER"], value: 4 }] },
              ],
            },
          },
        ],
      },
    });

    const windows = getAccountInsightSummary(windowed, "follows_and_unfollows")!
      .windows;
    expect(windows).toHaveLength(2);
    expect(getFollowsSplit(windows[0]!.breakdowns)).toMatchObject({ follows: 10 });
    expect(getFollowsSplit(windows[1]!.breakdowns)).toMatchObject({ unfollows: 4 });
  });

  it("aggregates chunked windows: summed totals, merged breakdowns, stitched series", () => {
    const windowed = summarizeAccountInsights({
      likes: {
        total_0: [{ total_value: { value: 100 } }],
        total_1: [{ total_value: { value: 40 } }],
        breakdown_media_product_type_0: [
          {
            total_value: {
              breakdowns: [
                { results: [{ dimension_values: ["REEL"], value: 70 }] },
              ],
            },
          },
        ],
        breakdown_media_product_type_1: [
          {
            total_value: {
              breakdowns: [
                { results: [{ dimension_values: ["REEL"], value: 30 }] },
              ],
            },
          },
        ],
      },
      reach: {
        total_0: [{ total_value: { value: 500 } }],
        total_1: [{ total_value: { value: 300 } }],
        time_series_0: [
          { values: [{ end_time: "2026-07-01T00:00:00Z", value: 20 }] },
        ],
        time_series_1: [
          { values: [{ end_time: "2026-08-01T00:00:00Z", value: 30 }] },
        ],
      },
    });

    expect(getAccountInsightSummary(windowed, "likes")).toMatchObject({
      total: 140,
      displayValue: "140",
      breakdowns: { media_product_type: [{ label: "Reel", value: 100 }] },
    });
    // Unique-account counts are only approximate when summed across windows.
    expect(getAccountInsightSummary(windowed, "reach")).toMatchObject({
      total: 800,
      displayValue: "~800",
      points: [
        { timestamp: "2026-07-01T00:00:00Z", value: 20 },
        { timestamp: "2026-08-01T00:00:00Z", value: 30 },
      ],
    });
  });
});

describe("getOnlineFollowersHeatmap", () => {
  // This account's day closes at 07:00 UTC, i.e. its local midnight — so
  // hour 9 of the measured day is 16:00 UTC, which is 18:00 in Prague (CEST)
  // during summer and 17:00 (CET) in winter.
  const buildMetrics = (values: Json[]) => ({
    online_followers: { time_series: [{ name: "online_followers", values }] },
  });

  it("buckets account-local hours into Prague weekdays and hours", () => {
    const heatmap = getOnlineFollowersHeatmap(
      buildMetrics([
        { end_time: "2026-08-18T07:00:00+0000", value: { "9": 100 } },
        { end_time: "2026-08-25T07:00:00+0000", value: { "9": 300, "10": 50 } },
      ]),
    );

    expect(heatmap).not.toBeNull();
    // Both samples land on Monday 18:00 Prague and are averaged.
    expect(heatmap!.grid[0]![18]).toBe(200);
    expect(heatmap!.grid[0]![19]).toBe(50);
    expect(heatmap!.grid[3]![18]).toBe(0);
    expect(heatmap!.max).toBe(200);
  });

  it("follows Prague daylight saving across the year", () => {
    const winter = getOnlineFollowersHeatmap(
      buildMetrics([{ end_time: "2026-01-20T07:00:00+0000", value: { "9": 60 } }]),
    );

    expect(winter!.grid[0]![17]).toBe(60);
    expect(winter!.grid[0]![18]).toBe(0);
  });

  it("returns null without any hourly data", () => {
    expect(getOnlineFollowersHeatmap({ online_followers: [] })).toBeNull();
    expect(getOnlineFollowersHeatmap({})).toBeNull();
  });
});
