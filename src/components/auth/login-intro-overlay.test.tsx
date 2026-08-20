import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginIntroOverlayView } from "./login-intro-overlay";

const DISMISS_NAME = "Dismiss intro video";

/**
 * Completes the overlay's fade-out so tests can assert the unmount.
 */
function finishDismiss(element: HTMLElement) {
  fireEvent.transitionEnd(element, { propertyName: "opacity" });
}

describe("LoginIntroOverlayView", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("plays the intro and animates it out on click", async () => {
    const user = userEvent.setup();
    const onPlayed = vi.fn();

    render(<LoginIntroOverlayView shouldPlay onPlayed={onPlayed} />);

    const dismiss = await screen.findByRole("button", { name: DISMISS_NAME });
    expect(onPlayed).toHaveBeenCalledOnce();

    await user.click(dismiss);

    expect(dismiss).toBeInTheDocument();
    expect(dismiss).toHaveClass("opacity-0");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    finishDismiss(dismiss);
    expect(
      screen.queryByRole("button", { name: DISMISS_NAME }),
    ).not.toBeInTheDocument();
  });

  it("dismisses the intro on any key after the fade-out", async () => {
    const user = userEvent.setup();

    render(<LoginIntroOverlayView shouldPlay onPlayed={vi.fn()} />);

    const dismiss = await screen.findByRole("button", { name: DISMISS_NAME });

    await user.keyboard("a");
    expect(dismiss).toBeInTheDocument();
    expect(dismiss).toHaveClass("opacity-0");

    finishDismiss(dismiss);
    expect(
      screen.queryByRole("button", { name: DISMISS_NAME }),
    ).not.toBeInTheDocument();
  });

  it("dismisses the intro when the video ends after the fade-out", async () => {
    render(<LoginIntroOverlayView shouldPlay onPlayed={vi.fn()} />);

    const dismiss = await screen.findByRole("button", { name: DISMISS_NAME });
    const media = dismiss.querySelector("video");
    expect(media).not.toBeNull();
    fireEvent.ended(media!);

    expect(dismiss).toBeInTheDocument();
    finishDismiss(dismiss);
    expect(
      screen.queryByRole("button", { name: DISMISS_NAME }),
    ).not.toBeInTheDocument();
  });

  it("ignores unrelated transition events while leaving", async () => {
    const user = userEvent.setup();

    render(<LoginIntroOverlayView shouldPlay onPlayed={vi.fn()} />);

    const dismiss = await screen.findByRole("button", { name: DISMISS_NAME });
    await user.click(dismiss);

    fireEvent.transitionEnd(dismiss, { propertyName: "transform" });
    expect(dismiss).toBeInTheDocument();

    finishDismiss(dismiss);
    expect(
      screen.queryByRole("button", { name: DISMISS_NAME }),
    ).not.toBeInTheDocument();
  });

  it("skips the intro when the user prefers reduced motion", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onPlayed = vi.fn();
    render(<LoginIntroOverlayView shouldPlay onPlayed={onPlayed} />);

    expect(onPlayed).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: DISMISS_NAME }),
    ).not.toBeInTheDocument();
  });
});
