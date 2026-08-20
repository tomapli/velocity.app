import { describe, expect, it } from "vitest";

import { hasAppAuthorizedClaim } from "./claims";

describe("hasAppAuthorizedClaim", () => {
  it("returns true only for an explicit true claim", () => {
    expect(hasAppAuthorizedClaim({ app_authorized: true })).toBe(true);
    expect(hasAppAuthorizedClaim({ app_authorized: false })).toBe(false);
    expect(hasAppAuthorizedClaim({ app_authorized: "true" })).toBe(false);
    expect(hasAppAuthorizedClaim({})).toBe(false);
    expect(hasAppAuthorizedClaim(null)).toBe(false);
    expect(hasAppAuthorizedClaim(undefined)).toBe(false);
  });
});
