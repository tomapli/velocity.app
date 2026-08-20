import { afterEach, describe, expect, it } from "vitest";

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const ORIGINAL_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  } else {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = ORIGINAL_KEY;
  }

  if (ORIGINAL_HOST === undefined) {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  } else {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = ORIGINAL_HOST;
  }
});

describe("getPostHogServer", () => {
  it("returns null when the API key is not set", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const { getPostHogServer } = await import("./posthog-server");

    expect(getPostHogServer()).toBeNull();
  });
});
