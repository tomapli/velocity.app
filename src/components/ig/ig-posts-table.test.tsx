import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IgPostsTable } from "@/components/ig/ig-posts-table";
import type { IgPost } from "@/lib/ig/queries";

function post(overrides: Partial<IgPost> = {}): IgPost {
  return {
    id: "e1000000-0000-4000-8000-000000000001",
    ig_profile_id: "e1000000-0000-4000-8000-000000000002",
    source_scrape_id: "e1000000-0000-4000-8000-000000000003",
    details_scrape_id: "e1000000-0000-4000-8000-000000000004",
    uploaded_at: "2026-08-20T10:00:00.000Z",
    thumbnail_url: "https://example.com/thumb.jpg",
    post_url: "https://www.instagram.com/p/ABC/",
    first_frame_url: "https://example.com/frame.jpg",
    video_embed_url: "https://example.com/video.mp4",
    media_type: "short",
    carousel_image_urls: null,
    video_length_secs: 18,
    view_count: 1000,
    save_count: 40,
    share_count: 30,
    comment_count: 20,
    like_count: 100,
    description: "A caption",
    created_at: "2026-08-20T11:00:00.000Z",
    ...overrides,
  };
}

describe("IgPostsTable", () => {
  it("renders available metrics and hides omitted values", () => {
    render(
      <IgPostsTable
        username="velocity"
        posts={[
          post(),
          post({
            id: "e1000000-0000-4000-8000-000000000003",
            view_count: 0,
            save_count: null,
            description: null,
            video_length_secs: null,
            media_type: "static",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(screen.getByText("39%")).toBeInTheDocument();
    expect(screen.getByText("A caption")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open post details" })[0]).toHaveAttribute(
      "href",
      "/ig/velocity/e1000000-0000-4000-8000-000000000001",
    );
    expect(screen.queryByText("Comment quality")).not.toBeInTheDocument();
  });
});

describe("IgPostsToolbar filters", () => {
  it("keeps the export control available from the table page chrome", async () => {
    const { IgPostsToolbar } = await import("@/components/ig/ig-posts-toolbar");
    const user = userEvent.setup();
    const onMediaTypesChange = vi.fn();

    render(
      <IgPostsToolbar
        mediaTypes={[]}
        onMediaTypesChange={onMediaTypesChange}
        sortKey="uploaded_at"
        sortDirection="desc"
        onSortKeyChange={vi.fn()}
        onSortDirectionChange={vi.fn()}
        onRescan={vi.fn()}
        onExport={vi.fn()}
        canExport
        isRescanning={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Statics" }));
    expect(onMediaTypesChange).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /rescan/i })).toBeEnabled();
  });
});
