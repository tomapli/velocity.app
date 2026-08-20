import { describe, expect, it } from "vitest";

import { validateRedirectUrl } from "./utils";

describe("validateRedirectUrl", () => {
  const origin = "http://localhost:3000";

  it("allows relative paths", () => {
    expect(validateRedirectUrl("/items", origin)).toBe("/items");
  });

  it("rejects protocol-relative and external URLs", () => {
    expect(validateRedirectUrl("//evil.test", origin)).toBeNull();
    expect(validateRedirectUrl("https://evil.test", origin)).toBeNull();
  });

  it("allows same-origin absolute URLs as a path", () => {
    expect(validateRedirectUrl("http://localhost:3000/next", origin)).toBe(
      "/next",
    );
  });
});
