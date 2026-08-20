import { describe, expect, it } from "vitest";

import { pictureUrlFromUserMetadata } from "./sync-authorized-user-picture";

describe("pictureUrlFromUserMetadata", () => {
  it("prefers picture over avatar_url", () => {
    expect(
      pictureUrlFromUserMetadata({
        picture: "https://example.com/picture.jpg",
        avatar_url: "https://example.com/avatar.jpg",
      }),
    ).toBe("https://example.com/picture.jpg");
  });

  it("falls back to avatar_url", () => {
    expect(
      pictureUrlFromUserMetadata({
        avatar_url: "https://example.com/avatar.jpg",
      }),
    ).toBe("https://example.com/avatar.jpg");
  });

  it("returns null when metadata is empty", () => {
    expect(pictureUrlFromUserMetadata(undefined)).toBeNull();
    expect(pictureUrlFromUserMetadata({})).toBeNull();
  });
});
