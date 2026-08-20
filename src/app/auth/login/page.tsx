import { headers } from "next/headers";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { VelocityLogo } from "@/components/brand/velocity-logo";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { createClient } from "@/lib/supabase/server";
import { validateRedirectUrl } from "@/lib/utils";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol =
    headersList.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const validatedNext = next ? validateRedirectUrl(next, origin) : undefined;

  return (
    <AuthPageShell>
      <div className="flex flex-col items-center space-y-6 text-center">
        <VelocityLogo size="auth" motion="metal" />
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-muted-foreground">
            Continue with Google. This signs you in or creates an account.
          </p>
        </div>
      </div>

      {user ? (
        <div className="space-y-4 rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">You are already signed in.</p>
          <Button asChild className="w-full" size="lg">
            <Link href={DEFAULT_LOGGED_IN_PAGE}>Go to app</Link>
          </Button>
        </div>
      ) : (
        <GoogleSignInButton next={validatedNext ?? undefined} />
      )}
    </AuthPageShell>
  );
}
