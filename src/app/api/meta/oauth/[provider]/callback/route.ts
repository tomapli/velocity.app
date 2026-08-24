import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { exchangeMetaOauthCode } from "@/lib/meta/api";
import {
  META_OAUTH_MESSAGE_TYPE,
  META_OAUTH_STATE_COOKIE,
} from "@/lib/meta/constants";
import { saveMetaConnection } from "@/lib/meta/connections";
import { decodeMetaOauthState } from "@/lib/meta/oauth-state";
import {
  getMetaOauthOrigin,
  getMetaOauthRedirectUri,
} from "@/lib/meta/oauth-url";
import type { MetaOauthProvider } from "@/lib/meta/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/meta/oauth/[provider]/callback">,
) {
  const origin = getMetaOauthOrigin(request);
  const { provider: rawProvider } = await context.params;
  if (rawProvider !== "facebook" && rawProvider !== "instagram") {
    return oauthResult(origin, false, "Unknown Meta login provider");
  }
  const provider: MetaOauthProvider = rawProvider;
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(META_OAUTH_STATE_COOKIE);
  const queryState = request.nextUrl.searchParams.get("state");
  const state = queryState ? decodeMetaOauthState(queryState) : null;
  if (!cookieState || cookieState !== queryState || !state || state.provider !== provider) {
    return oauthResult(origin, false, "The Meta login request expired. Try again.");
  }

  const denied = request.nextUrl.searchParams.get("error_description");
  if (denied) {
    return oauthResult(origin, false, denied);
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return oauthResult(origin, false, "Meta did not return an authorization code.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return oauthResult(origin, false, "Your Velocity session expired. Sign in and try again.");
  }

  try {
    const redirectUri = getMetaOauthRedirectUri(request, provider);
    const access = await exchangeMetaOauthCode(provider, code, redirectUri);
    const saved = await saveMetaConnection({
      admin: createAdminClient(),
      provider,
      access,
      createdBy: user.id,
    });
    const matched = state.username === "__workspace__" || saved.accounts.some(
      (account) => account.username.toLowerCase() === state.username,
    );
    return oauthResult(
      origin,
      true,
      state.username === "__workspace__"
        ? `Connected ${saved.connection.display_name}.`
        : matched
        ? `Connected ${saved.connection.display_name}.`
        : `Connected ${saved.connection.display_name}, but it does not grant access to @${state.username}.`,
    );
  } catch (oauthError) {
    return oauthResult(
      origin,
      false,
      oauthError instanceof Error ? oauthError.message : "Could not connect Meta",
    );
  }
}

function oauthResult(origin: string, success: boolean, message: string): Response {
  const payload = JSON.stringify({
    type: META_OAUTH_MESSAGE_TYPE,
    success,
    message,
  }).replaceAll("<", "\\u003c");
  const safeMessage = escapeHtml(message);
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Meta connection</title></head>
  <body>
    <p>${safeMessage}</p>
    <button type="button" onclick="window.close()">Close</button>
    <script>
      if (window.opener) window.opener.postMessage(${payload}, ${JSON.stringify(origin)});
      window.close();
    </script>
  </body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
