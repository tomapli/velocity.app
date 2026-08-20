import { describe, expect, it } from "vitest";

import { isUnauthorizedSignupError } from "./errors";

describe("isUnauthorizedSignupError", () => {
  it("matches the hook message", () => {
    expect(
      isUnauthorizedSignupError(
        "This email is not authorized to access the app.",
      ),
    ).toBe(true);
  });

  it("matches plus-encoded OAuth query values", () => {
    expect(
      isUnauthorizedSignupError(
        "This+email+is+not+authorized+to+access+the+app.",
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isUnauthorizedSignupError("No code provided")).toBe(false);
    expect(isUnauthorizedSignupError(null)).toBe(false);
  });
});
