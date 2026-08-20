import {
  IG_INSTAGRAM_ORIGIN,
  IG_USERNAME_MAX_LENGTH,
  IG_USERNAME_PATTERN,
} from "@/lib/ig/constants";

export interface ParsedIgInput {
  username: string;
  isUrlInput: boolean;
}

/**
 * Normalizes a raw handle by stripping @ and lowercasing.
 */
export function normalizeIgUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Parses search input as either an Instagram URL or a plain username.
 */
export function parseIgSearchInput(raw: string): ParsedIgInput | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (looksLikeUrl(trimmed)) {
    const username = usernameFromInstagramUrl(trimmed);
    if (!username) {
      return null;
    }

    return { username, isUrlInput: true };
  }

  const username = normalizeIgUsername(trimmed);
  if (!IG_USERNAME_PATTERN.test(username)) {
    return null;
  }

  return { username, isUrlInput: false };
}

/**
 * Builds the public Instagram profile URL for a validated username.
 */
export function instagramProfileUrl(username: string): string {
  return `${IG_INSTAGRAM_ORIGIN}/${encodeURIComponent(username)}/`;
}

function looksLikeUrl(value: string): boolean {
  return (
    value.includes("instagram.com") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("www.")
  );
}

function usernameFromInstagramUrl(raw: string): string | null {
  try {
    const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(withProtocol);

    if (!url.hostname.replace(/^www\./, "").endsWith("instagram.com")) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const candidate = segments[0]?.toLowerCase();

    if (!candidate || candidate === "p" || candidate === "reel" || candidate === "stories") {
      return null;
    }

    if (candidate.length > IG_USERNAME_MAX_LENGTH || !IG_USERNAME_PATTERN.test(candidate)) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}
