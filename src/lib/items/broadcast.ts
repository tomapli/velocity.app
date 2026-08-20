import type { Item } from "@/lib/items/queries";

interface BroadcastChangePayload {
  record?: unknown;
  old_record?: unknown;
  new?: unknown;
  old?: unknown;
}

/**
 * Reads the row from a `realtime.broadcast_changes` payload.
 * Insert/update use `record` (sometimes `new`); delete uses `old_record`.
 */
export function itemFromBroadcastPayload(
  payload: unknown,
  operation: "INSERT" | "UPDATE" | "DELETE",
): Item | null {
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

  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.title !== "string") {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    created_by: typeof row.created_by === "string" ? row.created_by : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}
