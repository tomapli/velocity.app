import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { IgAccountInsights } from "@/lib/ig/queries";
import type { Json } from "@/lib/supabase/database.types";

import { IgAccountInsightsPanel } from "./ig-account-insights";

function makeRow(periodDays: number, metrics: Json): IgAccountInsights {
  return {
    id: `insights-${periodDays}`,
    ig_profile_id: "profile-1",
    group_id: "group-1",
    period_days: periodDays,
    period_start: "2026-02-27T00:00:00Z",
    period_end: "2026-08-26T00:00:00Z",
    metrics,
    captured_at: "2026-08-26T00:00:00Z",
  };
}

/** Two Mondays of hourly data that average to 200 online at 18:00 Prague. */
const ONLINE_FOLLOWERS_METRICS: Json = {
  online_followers: {
    time_series: [
      {
        name: "online_followers",
        values: [
          { end_time: "2026-08-18T07:00:00+0000", value: { "9": 100 } },
          { end_time: "2026-08-25T07:00:00+0000", value: { "9": 300, "10": 50 } },
        ],
      },
    ],
  },
};

function makeViewsMetrics(total: number): Json {
  return { views: { total: [{ name: "views", total_value: { value: total } }] } };
}

describe("IgAccountInsightsPanel", () => {
  it("defaults to the 180-day window and switches ranges on demand", async () => {
    const user = userEvent.setup();
    render(
      <IgAccountInsightsPanel
        insights={[makeRow(15, makeViewsMetrics(150)), makeRow(180, makeViewsMetrics(1_800))]}
      />,
    );

    expect(screen.getByText("1.8K")).toBeInTheDocument();
    expect(screen.queryByText("150")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "15d" }));

    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.queryByText("1.8K")).not.toBeInTheDocument();
  });

  it("keeps detailed metrics collapsed until requested", async () => {
    const user = userEvent.setup();
    render(
      <IgAccountInsightsPanel insights={[makeRow(180, makeViewsMetrics(42))]} />,
    );

    expect(screen.queryByText("Likes")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show detailed metrics/i }),
    );

    expect(screen.getByText("Likes")).toBeInTheDocument();
  });

  it("names the busiest hour of each day for assistive tech", () => {
    render(
      <IgAccountInsightsPanel insights={[makeRow(180, ONLINE_FOLLOWERS_METRICS)]} />,
    );

    expect(
      screen.getByRole("img", { name: /Mon: busiest at 18:00, about 200/ }),
    ).toBeInTheDocument();
  });

  it("shows an exact reading when a heatmap cell is hovered", async () => {
    const user = userEvent.setup();
    render(
      <IgAccountInsightsPanel insights={[makeRow(180, ONLINE_FOLLOWERS_METRICS)]} />,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Cells sit in hour order inside their weekday row.
    const monday = screen.getByRole("img", { name: /^Mon:/ });
    await user.hover(monday.children[18] as HTMLElement);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Mon 18:00");
    expect(tooltip).toHaveTextContent("200");
  });

  it("explains a range that has no snapshot yet", async () => {
    const user = userEvent.setup();
    render(
      <IgAccountInsightsPanel
        insights={[makeRow(180, makeViewsMetrics(42))]}
        isRefreshing
      />,
    );

    await user.click(screen.getByRole("radio", { name: "30d" }));

    expect(screen.getByText("No 30-day insights yet")).toBeInTheDocument();
  });

  it("follows an externally controlled range and reports changes", async () => {
    const user = userEvent.setup();
    const onRangeDaysChange = vi.fn();
    render(
      <IgAccountInsightsPanel
        insights={[makeRow(15, makeViewsMetrics(150)), makeRow(180, makeViewsMetrics(1_800))]}
        rangeDays={15}
        onRangeDaysChange={onRangeDaysChange}
      />,
    );

    // The controlled value wins over the internal 180-day default.
    expect(screen.getByText("150")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "180d" }));

    expect(onRangeDaysChange).toHaveBeenCalledWith(180);
  });

  it("requests an unloaded range only when it is selected", async () => {
    const user = userEvent.setup();
    const onRangeRequest = vi.fn();
    render(
      <IgAccountInsightsPanel
        insights={[makeRow(180, makeViewsMetrics(42))]}
        onRangeRequest={onRangeRequest}
      />,
    );

    expect(onRangeRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "30d" }));

    expect(onRangeRequest).toHaveBeenCalledWith(30);
  });
});
