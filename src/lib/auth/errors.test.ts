import { describe, expect, it } from "vitest";

import { isJwtAuthError, isUnauthorizedSignupError } from "./errors";

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

describe("isJwtAuthError", () => {
  it("matches PostgREST JWT codes", () => {
    expect(
      isJwtAuthError({
        code: "PGRST303",
        message: "JWT issued at future",
      }),
    ).toBe(true);
    expect(isJwtAuthError({ code: "PGRST301", message: "JWT expired" })).toBe(
      true,
    );
  });

  it("matches JWT messages without a known code", () => {
    expect(isJwtAuthError(new Error("JWT expired"))).toBe(true);
    expect(isJwtAuthError("refresh_token_not_found")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isJwtAuthError({ code: "PGRST116", message: "not found" })).toBe(
      false,
    );
    expect(isJwtAuthError(null)).toBe(false);
  });
});
