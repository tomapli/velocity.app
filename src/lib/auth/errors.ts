import { UNAUTHORIZED_SIGNUP_MESSAGE } from "@/lib/constants/auth";

/** PostgREST codes for invalid/expired/skewed JWTs. */
const JWT_AUTH_ERROR_CODES = new Set(["PGRST301", "PGRST303"]);

/** Message fragments PostgREST/GoTrue use for dead sessions. */
const JWT_AUTH_ERROR_MESSAGE_FRAGMENTS = [
  "jwt expired",
  "jwt issued at future",
  "invalid jwt",
  "token is expired",
  "session_not_found",
  "refresh_token_not_found",
] as const;

/**
 * Decodes OAuth error query values that may be plus-encoded or percent-encoded.
 */
const decodeAuthErrorMessage = (message: string): string => {
  const withSpaces = message.replace(/\+/g, " ");

  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
};

/**
 * Returns true when Auth rejected signup because the email is not allowlisted.
 */
export const isUnauthorizedSignupError = (
  message: string | null | undefined,
): boolean => {
  if (!message) {
    return false;
  }

  const normalized = decodeAuthErrorMessage(message).toLowerCase();

  return normalized.includes(UNAUTHORIZED_SIGNUP_MESSAGE.toLowerCase());
};

interface ErrorWithCodeAndMessage {
  code?: unknown;
  message?: unknown;
}

/**
 * Returns true when an error is a dead/invalid JWT session (expired, skew, etc.).
 * Covers PostgREST PGRST301/303 and common Auth refresh failures.
 */
export const isJwtAuthError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    if (typeof error === "string") {
      return matchesJwtAuthMessage(error);
    }

    return false;
  }

  const { code, message } = error as ErrorWithCodeAndMessage;

  if (typeof code === "string" && JWT_AUTH_ERROR_CODES.has(code)) {
    return true;
  }

  if (typeof message === "string" && matchesJwtAuthMessage(message)) {
    return true;
  }

  // PostgREST sometimes stringifies the whole body into Error.message
  try {
    const serialized = JSON.stringify(error);
    return matchesJwtAuthMessage(serialized);
  } catch {
    return false;
  }
};

const matchesJwtAuthMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return JWT_AUTH_ERROR_MESSAGE_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
};
