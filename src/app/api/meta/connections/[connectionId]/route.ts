import { NextResponse } from "next/server";

import { deleteMetaConnection } from "@/lib/meta/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/meta/connections/[connectionId]">,
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectionId } = await context.params;
  await deleteMetaConnection(createAdminClient(), connectionId);
  return new NextResponse(null, { status: 204 });
}

