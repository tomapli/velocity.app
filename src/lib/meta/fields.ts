import type { MetaOauthProvider } from "@/lib/meta/types";

const META_INSTAGRAM_PROFILE_FIELDS = {
  facebook:
    "id,username,name,profile_picture_url,followers_count,media_count",
  instagram:
    "id,user_id,username,name,profile_picture_url,followers_count,media_count",
} as const satisfies Record<MetaOauthProvider, string>;

export function getMetaInstagramProfileFields(
  provider: MetaOauthProvider,
): string {
  return META_INSTAGRAM_PROFILE_FIELDS[provider];
}
