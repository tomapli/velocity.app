import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { GoogleSignInButton } from "./google-sign-in-button";

describe("GoogleSignInButton", () => {
  it("renders a Google continue button", () => {
    render(<GoogleSignInButton />);

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });
});
