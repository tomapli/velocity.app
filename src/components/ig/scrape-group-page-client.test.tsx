import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IgScrapeJob } from "@/lib/ig/groups";

import { ScrapeGroupPageClient } from "./scrape-group-page-client";

vi.mock("@/lib/ig/use-ig-scrapes-realtime", () => ({
  useIgScrapesRealtime: vi.fn(),
}));

const USER_ID = "e1000000-0000-4000-8000-000000000002";

const JOB: IgScrapeJob = {
  group: {
    created_at: "2026-08-20T10:00:00.000Z",
    created_by: USER_ID,
    id: "group-1",
    ig_profile_id: "profile-1",
    requested_post_count: 24,
    since_when: null,
    data_source: "public",
    scrape_method: "apify_instagram_scraper",
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
    {
      apify_called_at: "2026-08-20T10:00:02.000Z",
      apify_run_id: "run-posts",
      created_at: "2026-08-20T10:00:01.000Z",
      error_message: null,
      finished_at: "2026-08-20T10:03:00.000Z",
      group_id: "group-1",
      id: "scrape-posts",
      scrape_type: "posts",
      state: {},
      updated_at: "2026-08-20T10:03:00.000Z",
    },
    {
      apify_called_at: "2026-08-20T10:00:02.000Z",
      apify_run_id: "run-reels",
      created_at: "2026-08-20T10:00:01.000Z",
      error_message: null,
      finished_at: null,
      group_id: "group-1",
      id: "scrape-reels",
      scrape_type: "reels",
      state: {},
      updated_at: "2026-08-20T10:00:02.000Z",
    },
  ],
};

describe("ScrapeGroupPageClient", () => {
  it("shows the scrape summary, progress, and request pipeline", () => {
    render(<ScrapeGroupPageClient initialJob={JOB} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Scrape of @velocity" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/24 posts requested/)).toBeInTheDocument();
    expect(screen.getByText("Scraping")).toBeInTheDocument();
    // 2 listings + 1 expected details batch: 1 of 3 finished.
    expect(screen.getByText("1 of 3 expected requests done · 33%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Estimated progress 33%" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Request pipeline" })).toBeInTheDocument();
    // The running reels request is selected by default.
    expect(screen.getByRole("button", { name: /Reels listing/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("run-reels")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open profile/ })).toHaveAttribute("href", "/ig/velocity");
    expect(screen.getByRole("link", { name: /All scrapes/ })).toHaveAttribute(
      "href",
      "/settings/scrapes",
    );
  });
});
