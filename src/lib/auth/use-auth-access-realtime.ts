"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  AUTH_ACCESS_REALTIME_EVENTS,
  AUTH_UNAUTHORIZED_PATH,
  authAccessRealtimeTopic,
} from "@/lib/constants/auth";
import { createClient } from "@/lib/supabase/client";

interface UseAuthAccessRealtimeParams {
  userId: string;
}

/**
 * Subscribes to the private per-user auth channel and signs out on access revocation.
 * Removal from authorized_users is broadcast via `realtime.send` (not postgres_changes).
 */
export function useAuthAccessRealtime({
  userId,
}: UseAuthAccessRealtimeParams): void {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const revokingRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const topic = authAccessRealtimeTopic(userId);
    const channel = supabase.channel(topic, {
      config: {
        broadcast: { self: true },
        private: true,
      },
    });

    const revokeAccess = async () => {
      if (revokingRef.current) {
        return;
      }

      revokingRef.current = true;

      try {
        await supabase.auth.signOut({ scope: "local" });
        router.replace(AUTH_UNAUTHORIZED_PATH);
        router.refresh();
      } catch {
        revokingRef.current = false;
      }
    };

    channel.on(
      "broadcast",
      { event: AUTH_ACCESS_REALTIME_EVENTS.ACCESS_REVOKED },
      () => {
        void revokeAccess();
      },
    );

    let cancelled = false;

    const subscribe = async () => {
      await supabase.realtime.setAuth();
      if (cancelled) {
        return;
      }
      channel.subscribe();
    };

    void subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [router, supabase, userId]);
}
