import { describe, expect, it } from "vitest";

import { itemFromBroadcastPayload } from "./broadcast";

describe("itemFromBroadcastPayload", () => {
  it("reads an insert record from broadcast_changes shape", () => {
    const item = itemFromBroadcastPayload(
      {
        record: {
          id: "a",
          title: "Hello",
          created_by: "user-1",
          created_at: "2026-01-01T00:00:00Z",
        },
      },
      "INSERT",
    );

    expect(item).toEqual({
      id: "a",
      title: "Hello",
      created_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    });
  });

  it("reads a deleted row from old_record", () => {
    const item = itemFromBroadcastPayload(
      {
        old_record: {
          id: "b",
          title: "Gone",
          created_by: "user-2",
          created_at: "2026-01-01T00:00:00Z",
        },
      },
      "DELETE",
    );

    expect(item?.id).toBe("b");
  });

  it("returns null for malformed payloads", () => {
    expect(itemFromBroadcastPayload(null, "INSERT")).toBeNull();
    expect(itemFromBroadcastPayload({ record: {} }, "INSERT")).toBeNull();
  });
});
