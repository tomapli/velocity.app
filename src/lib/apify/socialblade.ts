import { z } from "zod";

import { startActorRun } from "@/lib/apify/client";
import type { Updatable } from "@/lib/supabase/tables";

export const SOCIALBLADE_ACTOR_ID = "dami_studio~socialblade-scraper";
const SOCIALBLADE_PROFILE_LIMIT = 1;
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const ProfileSchema = z.object({
  platform: z.literal("instagram"),
  username: z.string(),
  displayName: z.string().nullish(),
  followers: z.number().int().min(0).max(POSTGRES_INTEGER_MAX).nullish(),
  errorCode: z.string().nullish(),
  charged: z.boolean().optional(),
});

export function startSocialbladeRun(token: string, username: string) {
  return startActorRun(token, SOCIALBLADE_ACTOR_ID, {
    profiles: [`instagram:${username}`],
    platform: "instagram",
    maxItems: SOCIALBLADE_PROFILE_LIMIT,
    includeGrowth: false,
    includeHistory: false,
  });
}

/** Only account fields are imported; diagnostic and unrelated rows are rejected. */
export function mapSocialbladeProfile(
  dataset: unknown[],
  username: string,
): Updatable<"ig_profiles"> {
  for (const item of dataset) {
    const parsed = ProfileSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    const row = parsed.data;
    if (
      row.errorCode || row.charged === false || row.followers == null ||
      row.username.replace(/^@/, "").toLowerCase() !== username.toLowerCase()
    ) {
      continue;
    }
    return {
      follower_count: row.followers,
      ...(row.displayName ? { ig_name: row.displayName } : {}),
    };
  }
  throw new Error("SocialBlade returned no matching Instagram account statistics. The account may not be indexed.");
}
