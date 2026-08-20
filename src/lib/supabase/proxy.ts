import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_LOGIN_PATH,
  DEFAULT_LOGGED_IN_PAGE,
  isPublicRoute,
  PROXY_AUTHENTICATED_USER_ID_HEADER,
} from "@/lib/constants/auth";
import { redirectWithCookies } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

/**
 * Builds the Next.js response that forwards request cookies/headers to RSC.
 */
const createProxyResponse = (
  request: NextRequest,
  requestHeaders: Headers,
): NextResponse =>
  NextResponse.next({
    request: { headers: requestHeaders },
  });

/**
 * Copies Set-Cookie values onto a newly created proxy response.
 */
const copyResponseCookies = (
  from: NextResponse,
  to: NextResponse,
): void => {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
};

/**
 * Redirects unauthenticated users to login, preserving the intended destination.
 */
const redirectToLogin = (
  request: NextRequest,
  supabaseResponse: NextResponse,
  fullPath: string,
): NextResponse => {
  const url = request.nextUrl.clone();
  url.pathname = AUTH_LOGIN_PATH;
  url.search = "";
  url.hash = "";
  url.searchParams.set("next", fullPath);
  return redirectWithCookies(url, supabaseResponse);
};

/**
 * Refreshes the Auth session from cookies and gates non-public routes.
 * Expired/invalid JWTs are cleared locally and redirected to login instead of
 * reaching Server Components (which would throw PGRST303 from PostgREST).
 */
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  let supabaseResponse = createProxyResponse(request, requestHeaders);

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
          supabaseResponse = createProxyResponse(request, requestHeaders);
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

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Refresh failed or JWT unusable — drop stale cookies so RSC never sees them.
  if (claimsError || !claims) {
    if (claimsError) {
      await supabase.auth.signOut({ scope: "local" });
    }

    const pathname = request.nextUrl.pathname;
    const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

    if (isPublicRoute(pathname)) {
      return supabaseResponse;
    }

    return redirectToLogin(request, supabaseResponse, fullPath);
  }

  const pathname = request.nextUrl.pathname;
  const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

  if (isPublicRoute(pathname)) {
    if (pathname === AUTH_LOGIN_PATH) {
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

  const userId = claims.sub;
  if (typeof userId !== "string") {
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(request, supabaseResponse, fullPath);
  }

  requestHeaders.set(PROXY_AUTHENTICATED_USER_ID_HEADER, userId);
  const nextResponse = createProxyResponse(request, requestHeaders);
  copyResponseCookies(supabaseResponse, nextResponse);

  return nextResponse;
}
