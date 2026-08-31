import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check that `request` carries `Authorization: Bearer <secret>`.
 * A missing secret always fails so unconfigured deployments reject callbacks.
 */
export function hasBearerSecret(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}
