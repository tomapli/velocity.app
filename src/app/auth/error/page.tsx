import { AlertCircle } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { AUTH_LOGIN_PATH } from "@/lib/constants/auth";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  const error = params?.error || "";

  return (
    <AuthPageShell>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-full bg-muted p-6 text-destructive">
          <AlertCircle className="size-12" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            Authentication did not complete. Try signing in again.
          </p>
        </div>
        {error ? (
          <div className="w-full rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-left font-mono text-xs text-muted-foreground wrap-break-word">
              {error}
            </p>
          </div>
        ) : null}
        <Button asChild size="lg" className="w-full">
          <Link href={AUTH_LOGIN_PATH}>Back to sign in</Link>
        </Button>
      </div>
    </AuthPageShell>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ErrorContent searchParams={searchParams} />
    </Suspense>
  );
}
