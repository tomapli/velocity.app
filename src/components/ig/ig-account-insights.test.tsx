import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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
});
