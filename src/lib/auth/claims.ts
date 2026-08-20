import { APP_AUTHORIZED_CLAIM } from "@/lib/constants/auth";

/**
 * Returns true when JWT claims include the allowlist claim from the access-token hook.
 */
export const hasAppAuthorizedClaim = (
  claims: Record<string, unknown> | null | undefined,
): boolean => {
  if (!claims) {
    return false;
  }

  return claims[APP_AUTHORIZED_CLAIM] === true;
};
