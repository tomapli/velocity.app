import { UNAUTHORIZED_SIGNUP_MESSAGE } from "@/lib/constants/auth";

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
