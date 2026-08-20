import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | undefined;
}

/**
 * Request-scoped auth user for server components.
 * React cache() dedupes calls within a single request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) {
    return null;
  }

  return {
    id: sub,
    email:
      typeof data.claims.email === "string" ? data.claims.email : undefined,
  };
});
