import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { IgScrapeJob } from "@/lib/ig/groups";
import type { ScheduledScrape } from "@/lib/ig/queries";

import { ScrapeGroupList } from "./scrape-group-list";

const USER_ID = "e1000000-0000-4000-8000-000000000002";

function scrape(overrides: Partial<ScheduledScrape>): ScheduledScrape {
  return {
    apify_called_at: null,
    apify_run_id: null,
    created_at: "2026-08-20T10:00:01.000Z",
    error_message: null,
    finished_at: null,
    group_id: "group-1",
    id: "scrape-1",
    scrape_type: "posts",
    state: {},
    updated_at: "2026-08-20T10:00:01.000Z",
    ...overrides,
  };
}

const JOB: IgScrapeJob = {
  group: {
    created_at: "2026-08-20T10:00:00.000Z",
    created_by: USER_ID,
    id: "group-1",
    ig_profile_id: "profile-1",
    requested_post_count: 24,
    since_when: null,
    data_source: "meta_hybrid",
    meta_connection_id: null,
    meta_instagram_account_id: null,
  },
  profile: {
    created_at: "2026-08-20T09:00:00.000Z",
    created_by: USER_ID,
    description: null,
    id: "profile-1",
    ig_name: "Velocity",
    ig_username: "velocity",
    note: null,
    post_count: 40,
    follower_count: 1200,
    profile_picture_url: null,
    updated_at: "2026-08-20T09:00:00.000Z",
  },
  scrapes: [
    scrape({
      id: "scrape-posts",
      apify_called_at: "2026-08-20T10:00:02.000Z",
      apify_run_id: "run-posts",
      finished_at: "2026-08-20T10:03:00.000Z",
    }),
    scrape({
      id: "scrape-reels",
      scrape_type: "reels",
      apify_called_at: "2026-08-20T10:00:02.000Z",
      apify_run_id: "run-reels",
    }),
    scrape({
      id: "scrape-details",
      scrape_type: "post_details",
      finished_at: "2026-08-20T10:04:00.000Z",
      error_message: "Could not start Apify",
      state: { postUrls: ["https://www.instagram.com/p/abc/"] },
    }),
  ],
};

describe("ScrapeGroupList", () => {
  it("renders an empty state without scrapes", () => {
    render(<ScrapeGroupList jobs={[]} />);

    expect(screen.getByText("No scrapes yet")).toBeInTheDocument();
  });

  it("summarises each scrape and expands into its requests", async () => {
    const user = userEvent.setup();
    render(<ScrapeGroupList jobs={[JOB]} />);

    const trigger = screen.getByRole("button", { name: /@velocity/ });
    expect(trigger).toHaveTextContent("Scraping");
    expect(trigger).toHaveTextContent("Meta + public data");
    expect(trigger).toHaveTextContent("24 posts requested");
    expect(trigger).toHaveTextContent("2/3 requests done");
    expect(screen.queryByText("Posts listing")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("Posts listing")).toBeInTheDocument();
    expect(screen.getByText("Reels listing")).toBeInTheDocument();
    expect(screen.getByText("Post details")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("1 post in this batch")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not start Apify");
    expect(screen.getByText("run-posts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open profile/ })).toHaveAttribute(
      "href",
      "/ig/velocity",
    );
  });
});
