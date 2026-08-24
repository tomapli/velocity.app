import { NextResponse } from "next/server";
import { z } from "zod";

import { listValidatedMetaConnections } from "@/lib/meta/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{1,30}$/)
  .optional();

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedUsername = UsernameSchema.safeParse(
    new URL(request.url).searchParams.get("username") ?? undefined,
  );
  if (!parsedUsername.success) {
    return NextResponse.json({ error: "Invalid Instagram username" }, { status: 400 });
  }

  try {
    const lookup = await listValidatedMetaConnections(
      createAdminClient(),
      parsedUsername.data,
    );
    return NextResponse.json(lookup);
  } catch (lookupError) {
    return NextResponse.json(
      {
        error:
          lookupError instanceof Error
            ? lookupError.message
            : "Could not validate Meta connections",
      },
      { status: 502 },
    );
  }
}

