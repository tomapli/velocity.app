"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  igProfileFromBroadcastPayload,
  scheduledScrapeFromBroadcastPayload,
} from "@/lib/ig/broadcast";
import {
  IG_PROFILES_REALTIME_TOPIC,
  IG_SCRAPES_REALTIME_EVENTS,
  IG_SCRAPES_REALTIME_TOPIC,
} from "@/lib/ig/constants";
import type { IgProfile, ScheduledScrape } from "@/lib/ig/queries";
import { createClient } from "@/lib/supabase/client";

interface UseIgScrapesRealtimeParams {
  onScrapeInsert: (scrape: ScheduledScrape) => void;
  onScrapeUpdate: (scrape: ScheduledScrape) => void;
  onScrapeDelete: (scrape: ScheduledScrape) => void;
  onProfileInsert?: (profile: IgProfile) => void;
  onProfileUpdate?: (profile: IgProfile) => void;
  onProfileDelete?: (profile: IgProfile) => void;
}

/**
 * Subscribes to private broadcast events for scheduled scrapes and profiles.
 */
export function useIgScrapesRealtime({
  onScrapeInsert,
  onScrapeUpdate,
  onScrapeDelete,
  onProfileInsert,
  onProfileUpdate,
  onProfileDelete,
}: UseIgScrapesRealtimeParams): void {
  const supabase = useMemo(() => createClient(), []);
  const scrapeInsertRef = useRef(onScrapeInsert);
  const scrapeUpdateRef = useRef(onScrapeUpdate);
  const scrapeDeleteRef = useRef(onScrapeDelete);
  const profileInsertRef = useRef(onProfileInsert);
  const profileUpdateRef = useRef(onProfileUpdate);
  const profileDeleteRef = useRef(onProfileDelete);

  useEffect(() => {
    scrapeInsertRef.current = onScrapeInsert;
    scrapeUpdateRef.current = onScrapeUpdate;
    scrapeDeleteRef.current = onScrapeDelete;
    profileInsertRef.current = onProfileInsert;
    profileUpdateRef.current = onProfileUpdate;
    profileDeleteRef.current = onProfileDelete;
  }, [
    onScrapeInsert,
    onScrapeUpdate,
    onScrapeDelete,
    onProfileInsert,
    onProfileUpdate,
    onProfileDelete,
  ]);

  useEffect(() => {
    const scrapeChannel = supabase.channel(IG_SCRAPES_REALTIME_TOPIC, {
      config: { broadcast: { self: true }, private: true },
    });
    const profileChannel = supabase.channel(IG_PROFILES_REALTIME_TOPIC, {
      config: { broadcast: { self: true }, private: true },
    });

    const handleScrape = (
      operation: "INSERT" | "UPDATE" | "DELETE",
      payload: unknown,
    ) => {
      const scrape = scheduledScrapeFromBroadcastPayload(payload, operation);
      if (!scrape) {
        return;
      }

      if (operation === "INSERT") {
        scrapeInsertRef.current(scrape);
      } else if (operation === "UPDATE") {
        scrapeUpdateRef.current(scrape);
      } else {
        scrapeDeleteRef.current(scrape);
      }
    };

    const handleProfile = (
      operation: "INSERT" | "UPDATE" | "DELETE",
      payload: unknown,
    ) => {
      const profile = igProfileFromBroadcastPayload(payload, operation);
      if (!profile) {
        return;
      }

      if (operation === "INSERT") {
        profileInsertRef.current?.(profile);
      } else if (operation === "UPDATE") {
        profileUpdateRef.current?.(profile);
      } else {
        profileDeleteRef.current?.(profile);
      }
    };

    scrapeChannel
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.INSERT }, (message) =>
        handleScrape("INSERT", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.UPDATE }, (message) =>
        handleScrape("UPDATE", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.DELETE }, (message) =>
        handleScrape("DELETE", message.payload),
      );

    profileChannel
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.INSERT }, (message) =>
        handleProfile("INSERT", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.UPDATE }, (message) =>
        handleProfile("UPDATE", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.DELETE }, (message) =>
        handleProfile("DELETE", message.payload),
      );

    let cancelled = false;

    const subscribe = async () => {
      await supabase.realtime.setAuth();
      if (cancelled) {
        return;
      }
      scrapeChannel.subscribe();
      profileChannel.subscribe();
    };

    void subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(scrapeChannel);
      void supabase.removeChannel(profileChannel);
    };
  }, [supabase]);
}
