import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Group, IgProfile } from "@/lib/ig/queries";
import { getUploadedSinceIso, listIgPostsPageForProfile } from "@/lib/ig/queries";

import { IgProfilePageClient } from "./ig-profile-page-client";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/ig/use-ig-scrapes-realtime", () => ({ useIgScrapesRealtime: vi.fn() }));
vi.mock("@/lib/ig/queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ig/queries")>(),
  listIgPostsPageForProfile: vi.fn().mockResolvedValue({
    posts: [], hasMore: false, nextOffset: 0,
  }),
}));
vi.mock("@/components/ig/scrape-params-dialog", () => ({ ScrapeParamsDialog: () => null }));
vi.mock("@/components/ig/scrape-status-link", () => ({ ScrapeStatusLink: () => null }));

const PROFILE: IgProfile = {
  created_at: "2026-08-20T09:00:00.000Z",
  created_by: "e1000000-0000-4000-8000-000000000002",
  description: null,
  id: "e1000000-0000-4000-8000-000000000001",
  ig_name: null,
  ig_username: "velocity",
  note: null,
  post_count: null,
  follower_count: null,
  profile_picture_url: null,
  updated_at: "2026-08-20T09:00:00.000Z",
};

const GROUP: Group = {
  created_at: "2026-08-20T10:00:00.000Z",
  created_by: "e1000000-0000-4000-8000-000000000002",
  id: "e1000000-0000-4000-8000-000000000003",
  ig_profile_id: PROFILE.id,
  requested_post_count: 24,
  since_when: null,
  data_source: "public",
  scrape_method: "apify_instagram_scraper",
  meta_connection_id: null,
  meta_instagram_account_id: null,
};


afterEach(() => {
  vi.clearAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("public profile time filters", () => {
  it.each(["light", "dark"])("applies each upload window in %s mode", async (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const user = userEvent.setup();
    render(
      <IgProfilePageClient
        username={PROFILE.ig_username}
        initialJob={{ profile: PROFILE, group: GROUP, scrapes: [] }}
        initialPostsPage={{ posts: [], hasMore: false, nextOffset: 0 }}
      />,
    );

    expect(screen.getByRole("radio", { name: "180d" })).toHaveAttribute("aria-checked", "true");
    expect(listIgPostsPageForProfile).not.toHaveBeenCalled();

    for (const days of [30, 90, 180]) {
      await user.click(screen.getByRole("radio", { name: `${days}d` }));
      await waitFor(() => expect(listIgPostsPageForProfile).toHaveBeenLastCalledWith(
        expect.anything(),
        PROFILE.id,
        expect.objectContaining({ uploadedSince: getUploadedSinceIso(days) }),
      ));
      expect(screen.getByRole("radio", { name: `${days}d` })).toHaveAttribute("aria-checked", "true");
    }

    // Clicking the selected range must not clear the date filter.
    await user.click(screen.getByRole("radio", { name: "180d" }));
    expect(listIgPostsPageForProfile).toHaveBeenCalledTimes(3);
  });
});
