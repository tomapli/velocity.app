import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

const APIFY_IG_SCRAPES_WEBHOOK_PATH = "/api/webhooks/apify/ig-scrapes";

export async function proxy(request: NextRequest) {
  // Apify cannot carry a Supabase session. The route verifies its own bearer secret.
  if (request.nextUrl.pathname === APIFY_IG_SCRAPES_WEBHOOK_PATH) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
