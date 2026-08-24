import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  getMetaOauthOrigin,
  getMetaOauthRedirectUri,
} from "@/lib/meta/oauth-url";

describe("Meta OAuth URLs", () => {
  it("uses the public forwarded origin instead of the internal localhost URL", () => {
    const request = new NextRequest("http://localhost:3000/api/meta/oauth/facebook/start", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "app.velocity.ooo",
        "x-forwarded-proto": "https",
      },
    });

    expect(getMetaOauthOrigin(request)).toBe("https://app.velocity.ooo");
    expect(getMetaOauthRedirectUri(request, "facebook")).toBe(
      "https://app.velocity.ooo/api/meta/oauth/facebook/callback",
    );
  });

  it("keeps localhost for a local OAuth flow", () => {
    const request = new NextRequest(
      "http://localhost:3000/api/meta/oauth/instagram/start",
    );

    expect(getMetaOauthRedirectUri(request, "instagram")).toBe(
      "http://localhost:3000/api/meta/oauth/instagram/callback",
    );
  });

  it("uses the first value supplied by a trusted forwarding proxy", () => {
    const request = new NextRequest("http://localhost:3000/api/meta/oauth/facebook/start", {
      headers: {
        "x-forwarded-host": "preview.velocity.ooo, internal.proxy",
        "x-forwarded-proto": "https, http",
      },
    });

    expect(getMetaOauthOrigin(request)).toBe("https://preview.velocity.ooo");
  });
});
