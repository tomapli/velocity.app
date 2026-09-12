import { afterEach, describe, expect, it, vi } from "vitest";

import { mapSocialbladeProfile, startSocialbladeRun } from "./socialblade";

describe("SocialBlade account scraping", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts only the requested Instagram account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "run", defaultDatasetId: "dataset" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await startSocialbladeRun("token", "velocity");
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("dami_studio~socialblade-scraper/runs");
    expect(JSON.parse(options.body)).toEqual({
      profiles: ["instagram:velocity"], platform: "instagram", maxItems: 1,
      includeGrowth: false, includeHistory: false,
    });
  });

  it("maps account fields and preserves zero followers", () => {
    expect(mapSocialbladeProfile([
      { platform: "instagram", username: "@Velocity", displayName: "Velocity", followers: 0 },
    ], "velocity")).toEqual({ ig_name: "Velocity", follower_count: 0 });
  });

  it.each([
    [],
    [{ platform: "instagram", username: "other", followers: 10 }],
    [{ platform: "youtube", username: "velocity", followers: 10 }],
    [{ platform: "instagram", username: "velocity", followers: null }],
    [{ platform: "instagram", username: "velocity", followers: 10, charged: false }],
    [{ platform: "instagram", username: "velocity", errorCode: "NOT_FOUND" }],
  ])("rejects unavailable or unrelated account data: %j", (...items) => {
    expect(() => mapSocialbladeProfile(items, "velocity")).toThrow(/no matching Instagram/);
  });
});
