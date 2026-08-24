import {
  getCanonicalInstagramPostUrl,
  getInstagramShortcode,
} from "@/lib/apify/instagram-listing";

interface InstagramPostIdentity {
  ig_profile_id: string;
  post_url: string;
}

/**
 * Returns one row per Instagram shortcode, regardless of its /p or /reel alias.
 */
export function deduplicateIgPostsByShortcode<T extends InstagramPostIdentity>(
  posts: T[],
): T[] {
  const postsByIdentity = new Map<string, T>();

  for (const post of posts) {
    const shortcode = getInstagramShortcode(post.post_url);
    const identity = `${post.ig_profile_id}:${shortcode ?? post.post_url}`;
    const existing = postsByIdentity.get(identity);
    if (!existing) {
      postsByIdentity.set(identity, post);
      continue;
    }

    const canonicalUrl = getCanonicalInstagramPostUrl(post.post_url);
    const existingIsCanonical = existing.post_url === canonicalUrl;
    const postIsCanonical = post.post_url === canonicalUrl;
    if (postIsCanonical && !existingIsCanonical) {
      postsByIdentity.set(identity, post);
    }
  }

  return [...postsByIdentity.values()];
}
