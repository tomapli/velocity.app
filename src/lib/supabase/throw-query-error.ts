import { redirect } from "next/navigation";

import { isJwtAuthError } from "@/lib/auth/errors";
import { AUTH_LOGIN_PATH } from "@/lib/constants/auth";

/**
 * Re-throws query errors, except JWT/session failures which send the user to login.
 * Prevents expired or skewed access tokens from crashing RSC pages with PGRST303.
 */
export const throwQueryError = (error: unknown): never => {
  if (isJwtAuthError(error)) {
    redirect(AUTH_LOGIN_PATH);
  }

  throw error;
};
