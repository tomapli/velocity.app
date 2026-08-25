import { describe, expect, it } from "vitest";

import { getMetaInstagramProfileFields } from "@/lib/meta/fields";

describe("getMetaInstagramProfileFields", () => {
  it("requests the complete supported profile snapshot for both providers", () => {
    const commonFields = [
      "biography",
      "followers_count",
      "follows_count",
      "id",
      "media_count",
      "name",
      "profile_picture_url",
      "username",
      "website",
    ];

    for (const provider of ["facebook", "instagram"] as const) {
      expect(getMetaInstagramProfileFields(provider).split(",")).toEqual(
        expect.arrayContaining(commonFields),
      );
    }
  });

  it("does not request Instagram Login's user_id field through Facebook Graph", () => {
    expect(getMetaInstagramProfileFields("facebook").split(",")).not.toContain(
      "user_id",
    );
  });

  it("requests user_id for Instagram Login identity responses", () => {
    expect(getMetaInstagramProfileFields("instagram").split(",")).toContain(
      "user_id",
    );
  });
});
