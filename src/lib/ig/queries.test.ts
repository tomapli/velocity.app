import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  listIgPostsPageForProfile,
  type IgPostListItem,
} from "@/lib/ig/queries";
import type { Database } from "@/lib/supabase/database.types";

const PROFILE_ID = "e1000000-0000-4000-8000-000000000001";

function post(id: string): IgPostListItem {
  return {
    id,
    ig_profile_id: PROFILE_ID,
    uploaded_at: "2026-08-20T10:00:00.000Z",
    thumbnail_url: "https://example.com/thumb.jpg",
    post_url: `https://www.instagram.com/p/${id}/`,
    first_frame_url: null,
    video_embed_url: null,
    media_type: "static",
    video_length_secs: null,
    view_count: 100,
    save_count: 10,
    share_count: 5,
    comment_count: 4,
    like_count: 20,
    follows_count: null,
    reach_count: null,
    hook_rate: null,
    average_watch_time_ms: null,
    hold_rate: null,
    description: "Caption",
  };
}

interface MockQuery {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  supabase: SupabaseClient<Database>;
}

function mockQuery(rows: IgPostListItem[]): MockQuery {
  const range = vi.fn().mockResolvedValue({ data: rows, error: null });
  const builder: Record<string, ReturnType<typeof vi.fn>> = { range };
  const chain = (name: string) => {
    const fn = vi.fn(() => builder);
    builder[name] = fn;
    return fn;
  };
  const order = chain("order");
  const inFilter = chain("in");
  const eq = chain("eq");
  const select = chain("select");
  const from = vi.fn(() => builder);

  return {
    from,
    select,
    eq,
    in: inFilter,
    order,
    range,
    supabase: { from } as unknown as SupabaseClient<Database>,
  };
}

describe("listIgPostsPageForProfile", () => {
  it("selects only list fields and requests one extra row to detect another page", async () => {
    const query = mockQuery([post("first"), post("second"), post("third")]);

    const page = await listIgPostsPageForProfile(query.supabase, PROFILE_ID, {
      offset: 5,
      pageSize: 2,
    });

    expect(query.from).toHaveBeenCalledWith("ig_posts");
    const selectedColumns = String(query.select.mock.calls[0]?.[0]);
    expect(selectedColumns).toContain("thumbnail_url");
    expect(selectedColumns).not.toContain("carousel_image_urls");
    expect(query.eq).toHaveBeenCalledWith("ig_profile_id", PROFILE_ID);
    expect(query.in).not.toHaveBeenCalled();
    expect(query.order.mock.calls).toEqual([
      ["uploaded_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.range).toHaveBeenCalledWith(5, 7);
    expect(page).toEqual({
      posts: [post("first"), post("second")],
      hasMore: true,
      nextOffset: 7,
    });
  });

  it("sorts derived metrics in the database with omitted values last and newest-first ties", async () => {
    const query = mockQuery([]);

    await listIgPostsPageForProfile(query.supabase, PROFILE_ID, {
      sortKey: "weighted_er",
      sortDirection: "asc",
    });

    expect(query.order.mock.calls).toEqual([
      ["weighted_engagement_rate", { ascending: true, nullsFirst: false }],
      ["uploaded_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("filters media types in the database", async () => {
    const query = mockQuery([]);

    await listIgPostsPageForProfile(query.supabase, PROFILE_ID, {
      mediaTypes: ["short", "carousel"],
    });

    expect(query.in).toHaveBeenCalledWith("media_type", ["short", "carousel"]);
  });
});
