"use client";

import { useAuthAccessRealtime } from "@/lib/auth/use-auth-access-realtime";

interface AuthAccessGuardProps {
  userId: string;
}

/**
 * Keeps an authenticated session subscribed to allowlist revocation broadcasts.
 */
export function AuthAccessGuard({ userId }: AuthAccessGuardProps) {
  useAuthAccessRealtime({ userId });

  return null;
}
