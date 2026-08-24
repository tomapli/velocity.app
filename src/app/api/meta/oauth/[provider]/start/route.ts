import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildMetaAuthorizationUrl,
  isMetaProviderConfigured,
} from "@/lib/meta/api";
import {
  META_OAUTH_STATE_COOKIE,
  META_OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/meta/constants";
import { encodeMetaOauthState } from "@/lib/meta/oauth-state";
import type { MetaOauthProvider } from "@/lib/meta/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const QuerySchema = z.object({
  username: z.union([
    z.string().trim().toLowerCase().regex(/^[a-z0-9._]{1,30}$/),
    z.literal("__workspace__"),
  ]),
  returnTo: z
    .string()
    .startsWith("/")
    .refine((value) => !value.startsWith("//"))
    .default("/"),
});

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/meta/oauth/[provider]/start">,
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider: rawProvider } = await context.params;
  if (rawProvider !== "facebook" && rawProvider !== "instagram") {
    return NextResponse.json({ error: "Unknown Meta login provider" }, { status: 404 });
  }
  const provider: MetaOauthProvider = rawProvider;
  if (!isMetaProviderConfigured(provider)) {
    return NextResponse.json(
      { error: `Meta ${provider} login is not configured` },
      { status: 503 },
    );
  }

  const parsed = QuerySchema.safeParse({
    username: request.nextUrl.searchParams.get("username"),
    returnTo: request.nextUrl.searchParams.get("returnTo") ?? "/",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OAuth request" }, { status: 400 });
  }

  const state = encodeMetaOauthState({
    nonce: randomBytes(24).toString("base64url"),
    provider,
    returnTo: parsed.data.returnTo,
    username: parsed.data.username,
  });
  const redirectUri = getOauthRedirectUri(request.nextUrl.origin, provider);
  const cookieStore = await cookies();
  cookieStore.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: META_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/api/meta/oauth",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(
    buildMetaAuthorizationUrl(provider, redirectUri, state),
  );
}

function getOauthRedirectUri(origin: string, provider: MetaOauthProvider): string {
  const configuredBase = process.env.META_OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, "");
  const base = configuredBase ?? origin;
  return `${base}/api/meta/oauth/${provider}/callback`;
}
