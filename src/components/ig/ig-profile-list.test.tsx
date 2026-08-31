import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IgProfileOverview } from "@/lib/ig/profile-overviews";

import { IgProfileList } from "./ig-profile-list";

const USER_ID = "e1000000-0000-4000-8000-000000000002";

const PROFILE: IgProfileOverview["profile"] = {
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
};

const OVERVIEW: IgProfileOverview = {
  profile: PROFILE,
  scrapeCount: 2,
  latestJob: {
    profile: PROFILE,
    group: {
      created_at: "2026-08-20T10:00:00.000Z",
      created_by: USER_ID,
      id: "group-1",
      ig_profile_id: PROFILE.id,
      requested_post_count: 24,
      since_when: null,
      data_source: "public",
      scrape_method: "apify_instagram_scraper",
      meta_connection_id: null,
      meta_instagram_account_id: null,
    },
    scrapes: [
      {
        apify_called_at: "2026-08-20T10:00:02.000Z",
        apify_run_id: "run-posts",
        created_at: "2026-08-20T10:00:01.000Z",
        error_message: null,
        finished_at: "2026-08-20T10:03:00.000Z",
        group_id: "group-1",
        id: "scrape-1",
        scrape_type: "posts",
        state: {},
        updated_at: "2026-08-20T10:03:00.000Z",
      },
    ],
  },
};

describe("IgProfileList", () => {
  it("renders an empty state without profiles", () => {
    render(<IgProfileList overviews={[]} />);

    expect(screen.getByText("No profiles yet")).toBeInTheDocument();
  });

  it("shows the profile summary with its latest scrape state", () => {
    render(<IgProfileList overviews={[OVERVIEW]} />);

    expect(screen.getByRole("link", { name: "@velocity" })).toHaveAttribute(
      "href",
      "/ig/velocity",
    );
    expect(screen.getByRole("link", { name: "Ready" })).toHaveAttribute(
      "href",
      "/settings/scrapes/group-1",
    );
    expect(screen.getByText("Public data")).toBeInTheDocument();
    expect(screen.getByText("Velocity · 1,200 followers · 40 posts")).toBeInTheDocument();
    expect(screen.getByText(/2 scrapes · last/)).toBeInTheDocument();
  });

  it("explains when a profile has never been scraped", () => {
    render(
      <IgProfileList
        overviews={[{ profile: PROFILE, latestJob: null, scrapeCount: 0 }]}
      />,
    );

    expect(screen.getByText("No scrapes yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ready" })).not.toBeInTheDocument();
  });
});
