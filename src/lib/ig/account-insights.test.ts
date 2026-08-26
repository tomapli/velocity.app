import { describe, expect, it } from "vitest";

import {
  getAccountInsightSummary,
  summarizeAccountInsights,
} from "@/lib/ig/account-insights";

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
    expect(summaries).toHaveLength(15);
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
