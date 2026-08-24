import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CopilotSearchBar } from "@/components/ig/copilot-search-bar";

const PROFILES = [
  { ig_username: "saunia_cz", ig_name: "Saunia" },
  { ig_username: "salori.cz", ig_name: "Salori" },
  { ig_username: "velocity", ig_name: null },
];

describe("CopilotSearchBar", () => {
  it("shows every profile when the empty search is clicked", async () => {
    const user = userEvent.setup();

    render(
      <CopilotSearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        profiles={PROFILES}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(PROFILES.length);
  });

  it("keeps the list open while tabbing through every option", async () => {
    const user = userEvent.setup();

    render(
      <CopilotSearchBar
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        profiles={PROFILES}
      />,
    );

    const search = screen.getByRole("combobox");
    await user.click(search);

    for (const option of screen.getAllByRole("option")) {
      await user.tab();
      expect(option).toHaveFocus();
      expect(search).toHaveAttribute("aria-expanded", "true");
    }
  });
});
