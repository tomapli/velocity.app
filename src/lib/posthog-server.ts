import { PostHog } from "posthog-node";

let posthogInstance: PostHog | null = null;

/**
 * Returns the server PostHog client, or null when analytics is not configured.
 * Local `pnpm dev` does not require a PostHog key.
 */
export function getPostHogServer(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) {
    return null;
  }

  if (!posthogInstance) {
    posthogInstance = new PostHog(apiKey, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogInstance;
}
