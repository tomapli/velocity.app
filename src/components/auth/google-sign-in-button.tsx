"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AUTH_CALLBACK_PATH,
  AUTH_OAUTH_PROVIDER,
} from "@/lib/constants/auth";
import { createClient } from "@/lib/supabase/client";
import { validateRedirectUrl } from "@/lib/utils";

const GOOGLE_BUTTON_LABEL = "Continue with Google";
const GOOGLE_BUTTON_LOADING_LABEL = "Redirecting to Google";

interface GoogleSignInButtonProps {
  next?: string;
}

/**
 * Starts the Google OAuth flow. The same button signs in existing users
 * and creates an account when the email is on the allowlist.
 */
export function GoogleSignInButton({ next }: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const origin = window.location.origin;
    const redirectTo = new URL(AUTH_CALLBACK_PATH, origin);
    const safeNext = next ? validateRedirectUrl(next, origin) : null;

    if (safeNext) {
      redirectTo.searchParams.set("next", safeNext);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: AUTH_OAUTH_PROVIDER,
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="w-full"
        size="lg"
        disabled={isLoading}
        onClick={handleGoogleSignIn}
      >
        {isLoading ? (
          <>
            <Spinner />
            {GOOGLE_BUTTON_LOADING_LABEL}
          </>
        ) : (
          <>
            <GoogleMark />
            {GOOGLE_BUTTON_LABEL}
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Google G mark using currentColor so it follows the button text token.
 */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.22-1.4 3.58-5.27 3.58-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.18 3.61 14.29 2.8 12.18 2.8 7.51 2.8 3.73 6.58 3.73 11.2s3.78 8.4 8.45 8.4c4.88 0 8.1-3.43 8.1-8.26 0-.55-.06-.97-.13-1.24z"
      />
    </svg>
  );
}
