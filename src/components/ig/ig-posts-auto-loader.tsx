"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IG_POSTS_PAGE_SIZE } from "@/lib/ig/constants";

interface IgPostsAutoLoaderProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

const POSTS_PREFETCH_ROOT_MARGIN = "1200px 0px";

/** Prefetches the next post page before the pagination footer becomes visible. */
export function IgPostsAutoLoader({
  hasMore,
  isLoading,
  onLoadMore,
}: IgPostsAutoLoaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();
        onLoadMore();
      },
      { rootMargin: POSTS_PREFETCH_ROOT_MARGIN },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div ref={sentinelRef} className="flex min-h-10 items-center justify-center">
      {isLoading ? (
        <span
          role="status"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" aria-hidden />
          Loading more posts…
        </span>
      ) : (
        <Button type="button" variant="outline" onClick={onLoadMore}>
          Load {IG_POSTS_PAGE_SIZE} more posts
        </Button>
      )}
    </div>
  );
}
