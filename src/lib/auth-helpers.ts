import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";

/**
 * Creates an error URL with the given error message.
 */
export function createErrorUrl(request: NextRequest, errorMessage: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/error";
  url.searchParams.set("error", errorMessage);
  return url;
}

/**
 * Creates a success redirect URL after authentication.
 */
export function createSuccessUrl(
  request: NextRequest,
  next?: string | null,
): URL {
  const url = request.nextUrl.clone();

  if (next) {
    const validatedNext = validateRedirectUrl(next, request.nextUrl.origin);
    if (validatedNext) {
      const redirectUrl = new URL(validatedNext, request.nextUrl.origin);
      url.pathname = redirectUrl.pathname;
      url.search = redirectUrl.search;
      url.hash = redirectUrl.hash;
      return url;
    }
  }

  url.pathname = DEFAULT_LOGGED_IN_PAGE;
  url.search = "";
  url.hash = "";
  return url;
}

/**
 * Creates a redirect response with cookies copied from supabaseResponse.
 * Preserves all cookie options (httpOnly, secure, sameSite, etc.).
 */
export function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  const setCookieHeaders = supabaseResponse.headers.getSetCookie();
  setCookieHeaders.forEach((cookieHeader) => {
    redirectResponse.headers.append("Set-Cookie", cookieHeader);
  });
  return redirectResponse;
}
