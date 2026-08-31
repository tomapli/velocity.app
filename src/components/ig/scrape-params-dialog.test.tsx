import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrapeParamsDialog } from "./scrape-params-dialog";

const EMPTY_LOOKUP = { configured: false, connections: [], match: null };

describe("ScrapeParamsDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(EMPTY_LOOKUP),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to 500 posts and requires a scrape method at step 3", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ScrapeParamsDialog
        open
        onOpenChange={() => {}}
        username="velocity"
        isUrlInput={false}
        onConfirm={onConfirm}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /use public data/i }));

    expect(screen.getByLabelText(/how many posts/i)).toHaveValue(500);
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const confirm = screen.getByRole("button", { name: /confirm/i });
    expect(confirm).toBeDisabled();
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /profile posts/i }));
    await user.click(confirm);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        requestedPostCount: 500,
        sinceWhen: null,
        dataSource: "public",
        metaInstagramAccountId: null,
        scrapeMethod: "data_slayer_instagram_posts",
      });
    });
  });

  it("goes back to the range step before confirming", async () => {
    const user = userEvent.setup();

    render(
      <ScrapeParamsDialog
        open
        onOpenChange={() => {}}
        username="velocity"
        isUrlInput={false}
        onConfirm={() => {}}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /use public data/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByLabelText(/how many posts/i)).toBeInTheDocument();
  });
});
