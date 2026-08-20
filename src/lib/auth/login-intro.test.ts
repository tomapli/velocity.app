import { describe, expect, it } from "vitest";

import {
  hasLoginIntroQuery,
  stripLoginIntroPath,
  withLoginIntro,
} from "./login-intro";

describe("login intro query", () => {
  it("adds the welcome flag to a URL", () => {
    const url = withLoginIntro(new URL("http://localhost:3000/"));

    expect(url.searchParams.get("welcome")).toBe("1");
  });

  it("detects the welcome flag", () => {
    expect(hasLoginIntroQuery(new URLSearchParams("welcome=1"))).toBe(true);
    expect(hasLoginIntroQuery(new URLSearchParams("next=/"))).toBe(false);
  });

  it("strips the welcome flag and keeps other params", () => {
    expect(stripLoginIntroPath("/", new URLSearchParams("welcome=1"))).toBe("/");
    expect(
      stripLoginIntroPath("/items", new URLSearchParams("welcome=1&tab=open")),
    ).toBe("/items?tab=open");
  });
});
