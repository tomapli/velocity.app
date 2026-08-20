import { ShieldOff } from "lucide-react";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { AUTH_LOGIN_PATH } from "@/lib/constants/auth";

export default function UnauthorizedPage() {
  return (
    <AuthPageShell>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-full bg-muted p-6 text-muted-foreground">
          <ShieldOff className="size-12" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold">You need to be added</h1>
          <p className="text-muted-foreground">
            This email is not allowed to use the app yet. Ask to be added, then
            try again.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href={AUTH_LOGIN_PATH}>Back to sign in</Link>
        </Button>
      </div>
    </AuthPageShell>
  );
}
