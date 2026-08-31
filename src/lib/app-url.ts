/**
 * Public origin of the running deployment, without a trailing slash.
 *
 * `APP_URL` is the explicit, host-agnostic setting (required on Cloudflare
 * Workers). On Vercel the deployment URL is derived from `VERCEL_URL` when
 * `APP_URL` is unset. Returns null for local development without either.
 */
export function getAppUrl(): string | null {
  const explicit = process.env.APP_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return null;
}
