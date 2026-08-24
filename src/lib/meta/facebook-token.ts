import { z } from "zod";

const FACEBOOK_PAGE_GRANULAR_SCOPES = new Set([
  "pages_show_list",
  "pages_read_engagement",
]);

const FacebookTokenDebugSchema = z.object({
  data: z.object({
    granular_scopes: z
      .array(
        z.object({
          scope: z.string(),
          target_ids: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  }),
});

/** Returns Page IDs that the user explicitly selected in Meta's OAuth dialog. */
export function getGrantedFacebookPageIds(raw: unknown): string[] {
  const debug = FacebookTokenDebugSchema.parse(raw);
  const pageIds = (debug.data.granular_scopes ?? []).flatMap((permission) =>
    FACEBOOK_PAGE_GRANULAR_SCOPES.has(permission.scope)
      ? permission.target_ids ?? []
      : [],
  );

  return [...new Set(pageIds)];
}
