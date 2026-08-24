import { describe, expect, it } from "vitest";

import { getGrantedFacebookPageIds } from "@/lib/meta/facebook-token";

describe("getGrantedFacebookPageIds", () => {
  it("reads and deduplicates Page targets from granular OAuth permissions", () => {
    expect(
      getGrantedFacebookPageIds({
        data: {
          granular_scopes: [
            { scope: "pages_show_list", target_ids: ["page-1", "page-2"] },
            { scope: "pages_read_engagement", target_ids: ["page-1"] },
            { scope: "instagram_basic", target_ids: ["instagram-account"] },
          ],
        },
      }),
    ).toEqual(["page-1", "page-2"]);
  });

  it("returns no Page IDs when Meta provides no granular targets", () => {
    expect(getGrantedFacebookPageIds({ data: {} })).toEqual([]);
  });
});
