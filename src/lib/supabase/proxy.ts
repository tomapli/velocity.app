import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_LOGIN_PATH,
  DEFAULT_LOGGED_IN_PAGE,
  isPublicRoute,
} from "@/lib/constants/auth";
import { redirectWithCookies } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers?: Headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          headers?.forEach((value, key) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;
  const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

  if (isPublicRoute(pathname)) {
    if (pathname === AUTH_LOGIN_PATH && claims) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        const next = request.nextUrl.searchParams.get("next");
        const origin = request.nextUrl.origin;
        const validatedNext = next ? validateRedirectUrl(next, origin) : null;
        const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;

        const url = request.nextUrl.clone();
        url.pathname = redirectTo;
        url.search = "";
        url.hash = "";
        return redirectWithCookies(url, supabaseResponse);
      }
    }
    return supabaseResponse;
  }

  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_LOGIN_PATH;
    url.search = "";
    url.hash = "";
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
