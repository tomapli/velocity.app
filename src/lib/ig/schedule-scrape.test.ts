import { afterEach, describe, expect, it, vi } from "vitest";

import { scheduleIgScrape } from "@/lib/ig/schedule-scrape";

const JOB = {
  group: {
    created_at: "2026-08-20T10:00:00.000Z",
    created_by: "e1000000-0000-4000-8000-000000000002",
    id: "e1000000-0000-4000-8000-000000000003",
    ig_profile_id: "e1000000-0000-4000-8000-000000000001",
    requested_post_count: 12,
    since_when: null,
  },
  profile: {
    created_at: "2026-08-20T10:00:00.000Z",
    created_by: "e1000000-0000-4000-8000-000000000002",
    description: null,
    id: "e1000000-0000-4000-8000-000000000001",
    ig_name: null,
    ig_username: "velocity",
    note: null,
    post_count: null,
    profile_picture_url: null,
    updated_at: "2026-08-20T10:00:00.000Z",
  },
  scrapes: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scheduleIgScrape", () => {
  it("calls the authenticated server endpoint with scrape parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job: JOB }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      scheduleIgScrape({
        igUsername: "velocity",
        requestedPostCount: 12,
        sinceWhen: null,
      }),
    ).resolves.toEqual(JOB);

    expect(fetchMock).toHaveBeenCalledWith("/api/ig/scrapes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        igUsername: "velocity",
        requestedPostCount: 12,
        sinceWhen: null,
      }),
    });
  });

  it("returns the API error to the UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Apify is not configured" }), {
          status: 503,
        }),
      ),
    );

    await expect(scheduleIgScrape({ igUsername: "velocity" })).rejects.toThrow(
      "Apify is not configured",
    );
  });
});
