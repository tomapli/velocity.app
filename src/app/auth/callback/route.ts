import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { withLoginIntro } from "@/lib/auth/login-intro";
import {
  createAuthFailureUrl,
  createSuccessUrl,
  redirectWithCookies,
} from "@/lib/auth-helpers";

/**
 * Exchanges an auth code for a session (OAuth). Allowlist rejections land on
 * /auth/unauthorized; other failures go to /auth/error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(createAuthFailureUrl(request, oauthError));
  }

  if (!code) {
    return NextResponse.redirect(createAuthFailureUrl(request, "No code provided"));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirectWithCookies(
      createAuthFailureUrl(request, error.message),
      supabaseResponse,
    );
  }

  return redirectWithCookies(
    withLoginIntro(createSuccessUrl(request, next)),
    supabaseResponse,
  );
}
