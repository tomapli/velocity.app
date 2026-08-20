import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_PICTURE_METADATA_KEYS = ["picture", "avatar_url"] as const;

/**
 * Reads a Google profile picture URL from Supabase auth user metadata.
 */
export function pictureUrlFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of GOOGLE_PICTURE_METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

/**
 * Copies the Google profile picture into authorized_users for the signed-in user.
 */
export async function syncAuthorizedUserPicture(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error ?? !data.user?.email) {
    return;
  }

  const pictureUrl = pictureUrlFromUserMetadata(
    data.user.user_metadata as Record<string, unknown>,
  );

  if (!pictureUrl) {
    return;
  }

  await admin
    .from("authorized_users")
    .update({ picture_url: pictureUrl })
    .eq("email", data.user.email.toLowerCase().trim());
}
