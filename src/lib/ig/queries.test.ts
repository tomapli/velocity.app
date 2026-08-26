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
    follower_view_count: null,
    non_follower_view_count: null,
    follower_non_follower_ratio: null,
    reach_count: null,
    hook_rate: null,
    average_watch_time_ms: null,
    hold_rate: null,
    description: "Caption",
  };
}

describe("listIgPostsPageForProfile", () => {
  it("selects only list fields and requests one extra row to detect another page", async () => {
    const range = vi.fn().mockResolvedValue({
      data: [post("first"), post("second"), post("third")],
      error: null,
    });
    const order = vi.fn();
    const orderedQuery = { order, range };
    order.mockReturnValue(orderedQuery);
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient<Database>;

    const page = await listIgPostsPageForProfile(supabase, PROFILE_ID, 5, 2);

    expect(from).toHaveBeenCalledWith("ig_posts");
    const selectedColumns = String(select.mock.calls[0]?.[0]);
    expect(selectedColumns).toContain("thumbnail_url");
    expect(selectedColumns).not.toContain("carousel_image_urls");
    expect(orderedQuery.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(range).toHaveBeenCalledWith(5, 7);
    expect(page).toEqual({
      posts: [post("first"), post("second")],
      hasMore: true,
      nextOffset: 7,
    });
  });
});
