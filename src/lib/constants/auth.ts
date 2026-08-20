/**
 * Public route prefixes that do not require authentication.
 * Routes starting with these prefixes are accessible without being logged in.
 */
export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/auth"] as const;

export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_ERROR_PATH = "/auth/error";
export const AUTH_UNAUTHORIZED_PATH = "/auth/unauthorized";

/** Internal request header set only after the proxy verifies a user session. */
export const PROXY_AUTHENTICATED_USER_ID_HEADER = "x-velocity-authenticated-user-id";

/**
 * Default page to redirect users to after successful login.
 */
export const DEFAULT_LOGGED_IN_PAGE = "/";

export const AUTH_OAUTH_PROVIDER = "google" as const;

/**
 * Must match `public.before_user_created_hook`.
 */
export const UNAUTHORIZED_SIGNUP_MESSAGE =
  "This email is not authorized to access the app.";

/**
 * Query flag set after a successful OAuth login so the intro video can play once.
 */
export const LOGIN_INTRO_QUERY_PARAM = "welcome";
export const LOGIN_INTRO_QUERY_VALUE = "1";
export const LOGIN_INTRO_VIDEO_SRC = "/Generate_a_very_short_video_wh.mp4";

/**
 * Checks if a given pathname is a public route.
 */
export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};
