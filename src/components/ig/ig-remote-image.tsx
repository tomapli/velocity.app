"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface IgRemoteImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Renders an Instagram CDN image without Next image optimization.
 * Signed media URLs expire; a missing or failed src collapses to a placeholder.
 */
export function IgRemoteImage({ src, alt, className }: IgRemoteImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
        aria-hidden={alt ? undefined : true}
      >
        <ImageOff className="size-4" />
        {alt ? <span className="sr-only">{alt}</span> : null}
      </div>
    );
  }

  return (
    // Instagram CDN hosts vary and are signed; next/image remotePatterns cannot cover them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
