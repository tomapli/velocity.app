import {
  LOGIN_INTRO_QUERY_PARAM,
  LOGIN_INTRO_QUERY_VALUE,
} from "@/lib/constants/auth";

/**
 * Marks a post-login redirect so the intro video plays once.
 */
export const withLoginIntro = (url: URL): URL => {
  url.searchParams.set(LOGIN_INTRO_QUERY_PARAM, LOGIN_INTRO_QUERY_VALUE);

  return url;
};

/**
 * Returns true when the current URL should show the login intro video.
 */
export const hasLoginIntroQuery = (
  searchParams: Pick<URLSearchParams, "get">,
): boolean => {
  return searchParams.get(LOGIN_INTRO_QUERY_PARAM) === LOGIN_INTRO_QUERY_VALUE;
};

/**
 * Builds the same path with the intro flag removed so a refresh does not replay.
 */
export const stripLoginIntroPath = (
  pathname: string,
  searchParams: URLSearchParams,
): string => {
  const next = new URLSearchParams(searchParams);
  next.delete(LOGIN_INTRO_QUERY_PARAM);
  const query = next.toString();

  return query ? `${pathname}?${query}` : pathname;
};
