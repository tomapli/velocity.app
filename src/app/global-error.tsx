"use client";

import posthog from "posthog-js";
import NextError from "next/error";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
        <Button
          onClick={reset}
          className="fixed right-4 bottom-4"
        >
          Try again
        </Button>
      </body>
    </html>
  );
}
