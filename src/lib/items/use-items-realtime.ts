"use client";

import { useEffect, useMemo, useRef } from "react";

import { ITEMS_REALTIME_EVENTS, ITEMS_REALTIME_TOPIC } from "@/lib/items/constants";
import { itemFromBroadcastPayload } from "@/lib/items/broadcast";
import type { Item } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";

interface UseItemsRealtimeParams {
  onInsert: (item: Item) => void;
  onUpdate: (item: Item) => void;
  onDelete: (item: Item) => void;
}

/**
 * Subscribes to private broadcast events for the items table.
 * Database changes are published via `realtime.broadcast_changes` (not postgres_changes).
 */
export function useItemsRealtime({
  onInsert,
  onUpdate,
  onDelete,
}: UseItemsRealtimeParams): void {
  const supabase = useMemo(() => createClient(), []);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    const channel = supabase.channel(ITEMS_REALTIME_TOPIC, {
      config: {
        broadcast: { self: true },
        private: true,
      },
    });

    const handle = (
      operation: "INSERT" | "UPDATE" | "DELETE",
      payload: unknown,
    ) => {
      const item = itemFromBroadcastPayload(payload, operation);
      if (!item) {
        return;
      }

      if (operation === "INSERT") {
        onInsertRef.current(item);
      } else if (operation === "UPDATE") {
        onUpdateRef.current(item);
      } else {
        onDeleteRef.current(item);
      }
    };

    channel
      .on("broadcast", { event: ITEMS_REALTIME_EVENTS.INSERT }, (message) =>
        handle("INSERT", message.payload),
      )
      .on("broadcast", { event: ITEMS_REALTIME_EVENTS.UPDATE }, (message) =>
        handle("UPDATE", message.payload),
      )
      .on("broadcast", { event: ITEMS_REALTIME_EVENTS.DELETE }, (message) =>
        handle("DELETE", message.payload),
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
  }, [supabase]);
}
