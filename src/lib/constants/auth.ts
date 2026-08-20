/**
 * Public route prefixes that do not require authentication.
 * Routes starting with these prefixes are accessible without being logged in.
 */
export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/auth"] as const;

/**
 * Default page to redirect users to after successful login.
 */
export const DEFAULT_LOGGED_IN_PAGE = "/";

/**
 * Checks if a given pathname is a public route.
 */
export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};
