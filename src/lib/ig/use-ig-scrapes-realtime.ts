"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  groupFromBroadcastPayload,
  igProfileFromBroadcastPayload,
  scheduledScrapeFromBroadcastPayload,
} from "@/lib/ig/broadcast";
import {
  IG_GROUPS_REALTIME_TOPIC,
  IG_PROFILES_REALTIME_TOPIC,
  IG_SCRAPES_REALTIME_EVENTS,
  IG_SCRAPES_REALTIME_TOPIC,
} from "@/lib/ig/constants";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";
import { createClient } from "@/lib/supabase/client";

interface UseIgScrapesRealtimeParams {
  onScrapeInsert: (scrape: ScheduledScrape) => void;
  onScrapeUpdate: (scrape: ScheduledScrape) => void;
  onScrapeDelete: (scrape: ScheduledScrape) => void;
  onGroupInsert?: (group: Group) => void;
  onGroupUpdate?: (group: Group) => void;
  onGroupDelete?: (group: Group) => void;
  onProfileInsert?: (profile: IgProfile) => void;
  onProfileUpdate?: (profile: IgProfile) => void;
  onProfileDelete?: (profile: IgProfile) => void;
}

/**
 * Subscribes to private broadcast events for groups, scheduled scrapes, and profiles.
 */
export function useIgScrapesRealtime({
  onScrapeInsert,
  onScrapeUpdate,
  onScrapeDelete,
  onGroupInsert,
  onGroupUpdate,
  onGroupDelete,
  onProfileInsert,
  onProfileUpdate,
  onProfileDelete,
}: UseIgScrapesRealtimeParams): void {
  const supabase = useMemo(() => createClient(), []);
  const scrapeInsertRef = useRef(onScrapeInsert);
  const scrapeUpdateRef = useRef(onScrapeUpdate);
  const scrapeDeleteRef = useRef(onScrapeDelete);
  const groupInsertRef = useRef(onGroupInsert);
  const groupUpdateRef = useRef(onGroupUpdate);
  const groupDeleteRef = useRef(onGroupDelete);
  const profileInsertRef = useRef(onProfileInsert);
  const profileUpdateRef = useRef(onProfileUpdate);
  const profileDeleteRef = useRef(onProfileDelete);

  useEffect(() => {
    scrapeInsertRef.current = onScrapeInsert;
    scrapeUpdateRef.current = onScrapeUpdate;
    scrapeDeleteRef.current = onScrapeDelete;
    groupInsertRef.current = onGroupInsert;
    groupUpdateRef.current = onGroupUpdate;
    groupDeleteRef.current = onGroupDelete;
    profileInsertRef.current = onProfileInsert;
    profileUpdateRef.current = onProfileUpdate;
    profileDeleteRef.current = onProfileDelete;
  }, [
    onScrapeInsert,
    onScrapeUpdate,
    onScrapeDelete,
    onGroupInsert,
    onGroupUpdate,
    onGroupDelete,
    onProfileInsert,
    onProfileUpdate,
    onProfileDelete,
  ]);

  useEffect(() => {
    const scrapeChannel = supabase.channel(IG_SCRAPES_REALTIME_TOPIC, {
      config: { broadcast: { self: true }, private: true },
    });
    const groupChannel = supabase.channel(IG_GROUPS_REALTIME_TOPIC, {
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

    const handleGroup = (
      operation: "INSERT" | "UPDATE" | "DELETE",
      payload: unknown,
    ) => {
      const group = groupFromBroadcastPayload(payload, operation);
      if (!group) {
        return;
      }

      if (operation === "INSERT") {
        groupInsertRef.current?.(group);
      } else if (operation === "UPDATE") {
        groupUpdateRef.current?.(group);
      } else {
        groupDeleteRef.current?.(group);
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

    groupChannel
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.INSERT }, (message) =>
        handleGroup("INSERT", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.UPDATE }, (message) =>
        handleGroup("UPDATE", message.payload),
      )
      .on("broadcast", { event: IG_SCRAPES_REALTIME_EVENTS.DELETE }, (message) =>
        handleGroup("DELETE", message.payload),
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
      groupChannel.subscribe();
      profileChannel.subscribe();
    };

    void subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(scrapeChannel);
      void supabase.removeChannel(groupChannel);
      void supabase.removeChannel(profileChannel);
    };
  }, [supabase]);
}
