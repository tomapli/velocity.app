import { render, screen, waitFor, within } from "@testing-library/react";
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
    expect(within(screen.getByRole("radiogroup", { name: "Scrape method" })).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /^Meta$/ })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /profile posts/i }));
    await user.click(confirm);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        requestedPostCount: 500,
        sinceWhen: null,
        dataSource: "public",
        accountSource: "none",
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

  it.each(["light", "dark"])("selects SocialBlade and a public actor in %s theme", async (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ScrapeParamsDialog open onOpenChange={() => {}} username="velocity" isUrlInput={false} onConfirm={onConfirm} />);
    await user.click(await screen.findByRole("button", { name: /use public data/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("radio", { name: /^SocialBlade/ }));
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /listing \+ post details/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      accountSource: "socialblade", dataSource: "public", metaInstagramAccountId: null,
      scrapeMethod: "apify_instagram_scraper",
    }));
    document.documentElement.classList.remove("dark");
  });

  it("allows switching between Meta and SocialBlade after selecting an account in step 1", async () => {
    const account = { id: "account-1", username: "velocity", profilePictureUrl: null };
    const connection = { id: "connection-1", displayName: "Workspace", provider: "facebook", accounts: [account] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      configured: true, connections: [connection], match: { connection, account },
    })));
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ScrapeParamsDialog open onOpenChange={() => {}} username="velocity" isUrlInput={false} onConfirm={onConfirm} />);
    await user.click(await screen.findByRole("button", { name: /continue with meta/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    const meta = screen.getByRole("radio", { name: /^Meta$/ });
    expect(meta).toBeEnabled();
    expect(meta).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: /^SocialBlade/ }));
    expect(meta).toHaveAttribute("aria-checked", "false");
    await user.click(meta);
    await user.click(screen.getByRole("radio", { name: /profile posts/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      accountSource: "meta", dataSource: "meta_hybrid", metaInstagramAccountId: account.id,
    }));
  });
});
