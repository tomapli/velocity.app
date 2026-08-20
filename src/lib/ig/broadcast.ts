import type { IgProfile } from "@/lib/ig/queries";
import type { ScheduledScrape } from "@/lib/ig/queries";

interface BroadcastChangePayload {
  record?: unknown;
  old_record?: unknown;
  new?: unknown;
  old?: unknown;
}

/**
 * Reads a table row from a `realtime.broadcast_changes` payload.
 */
export function rowFromBroadcastPayload(
  payload: unknown,
  operation: "INSERT" | "UPDATE" | "DELETE",
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as BroadcastChangePayload;
  const raw =
    operation === "DELETE"
      ? (body.old_record ?? body.old ?? body.record)
      : (body.record ?? body.new);

  if (!raw || typeof raw !== "object") {
    return null;
  }

  return raw as Record<string, unknown>;
}

export function scheduledScrapeFromBroadcastPayload(
  payload: unknown,
  operation: "INSERT" | "UPDATE" | "DELETE",
): ScheduledScrape | null {
  const row = rowFromBroadcastPayload(payload, operation);
  if (typeof row?.id !== "string" || typeof row.group_id !== "string") {
    return null;
  }

  return row as ScheduledScrape;
}

export function igProfileFromBroadcastPayload(
  payload: unknown,
  operation: "INSERT" | "UPDATE" | "DELETE",
): IgProfile | null {
  const row = rowFromBroadcastPayload(payload, operation);
  if (typeof row?.id !== "string" || typeof row.ig_username !== "string") {
    return null;
  }

  return row as IgProfile;
}
