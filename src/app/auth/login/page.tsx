import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { createClient } from "@/lib/supabase/server";
import { validateRedirectUrl } from "@/lib/utils";
import { headers } from "next/headers";
import Link from "next/link";

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
    <main className="flex min-h-screen flex-col bg-background">
      <header className="absolute top-0 right-0 p-4 md:p-6">
        <ThemeSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-primary">
              Sign in
            </h1>
            <p className="text-muted-foreground">
              Use your email and password to continue.
            </p>
          </div>

          {user ? (
            <div className="space-y-4 rounded-xl border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">You are already signed in.</p>
              <Button asChild className="w-full" size="lg">
                <Link href={DEFAULT_LOGGED_IN_PAGE}>Go to app</Link>
              </Button>
            </div>
          ) : (
            <LoginForm next={validatedNext ?? undefined} />
          )}
        </div>
      </div>
    </main>
  );
}
