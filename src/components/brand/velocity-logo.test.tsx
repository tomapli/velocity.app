import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppHeaderBrand } from "@/components/brand/app-header-brand";
import { VelocityLogo } from "@/components/brand/velocity-logo";
import {
  VELOCITY_HOME_LABEL,
  VELOCITY_LOGO_ALT,
  VELOCITY_LOGO_METAL_SRC,
  VELOCITY_LOGO_SPIN_SRC,
} from "@/lib/constants/brand";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

describe("VelocityLogo", () => {
  it("renders the liquid-metal still with an accessible name", () => {
    render(<VelocityLogo size="auth" motion="metal" />);

    const image = screen.getByRole("img", { name: VELOCITY_LOGO_ALT });

    expect(image).toHaveAttribute("src", VELOCITY_LOGO_METAL_SRC);
  });

  it("plays the spin loop and keeps a reduced-motion still", () => {
    const { container } = render(
      <VelocityLogo size="header" motion="spin" decorative />,
    );

    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", VELOCITY_LOGO_SPIN_SRC);
    expect(images[0]).toHaveClass("motion-reduce:hidden");
    expect(images[1]).toHaveAttribute("src", VELOCITY_LOGO_METAL_SRC);
    expect(images[1]).toHaveClass("motion-reduce:block");
  });
});

describe("AppHeaderBrand", () => {
  it("links the spinning mark to home", () => {
    render(<AppHeaderBrand />);

    const home = screen.getByRole("link", { name: VELOCITY_HOME_LABEL });

    expect(home).toHaveAttribute("href", DEFAULT_LOGGED_IN_PAGE);
    expect(home.querySelector("img")).toHaveAttribute("src", VELOCITY_LOGO_SPIN_SRC);
  });
});
