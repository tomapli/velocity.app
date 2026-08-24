import { describe, expect, it } from "vitest";

import { getMetaInstagramProfileFields } from "@/lib/meta/fields";

describe("getMetaInstagramProfileFields", () => {
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
