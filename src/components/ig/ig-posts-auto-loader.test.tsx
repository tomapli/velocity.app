import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IgPostsAutoLoader } from "@/components/ig/ig-posts-auto-loader";

let observerCallback: IntersectionObserverCallback | null = null;
let observerOptions: IntersectionObserverInit | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    observerCallback = callback;
    observerOptions = options;
  }

  disconnect = disconnect;
  observe = observe;
  takeRecords = () => [];
  unobserve = vi.fn();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  observerCallback = null;
  observerOptions = undefined;
});

describe("IgPostsAutoLoader", () => {
  it("loads the next page before the sentinel enters the viewport", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const onLoadMore = vi.fn();
    render(
      <IgPostsAutoLoader
        hasMore
        isLoading={false}
        onLoadMore={onLoadMore}
      />,
    );

    expect(observe).toHaveBeenCalledOnce();
    expect(observerOptions).toEqual({ rootMargin: "1200px 0px" });

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(disconnect).toHaveBeenCalled();
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("keeps a manual load control as a fallback", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <IgPostsAutoLoader
        hasMore
        isLoading={false}
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load 25 older posts" }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
