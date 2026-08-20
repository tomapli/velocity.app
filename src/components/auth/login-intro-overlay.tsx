"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  hasLoginIntroQuery,
  stripLoginIntroPath,
} from "@/lib/auth/login-intro";
import { LOGIN_INTRO_VIDEO_SRC } from "@/lib/constants/auth";
import { cn } from "@/lib/utils";

const DISMISS_LABEL = "Dismiss intro video";
const DISMISS_TRANSITION_PROPERTY = "opacity";
const DISMISS_DURATION_MS = 500;

type IntroPhase = "hidden" | "playing" | "leaving";

interface LoginIntroOverlayViewProps {
  shouldPlay: boolean;
  onPlayed: () => void;
}

/**
 * Full-viewport login intro. Click, any key, or the video ending dismisses it
 * with a fade-and-scale animation.
 */
export function LoginIntroOverlayView({
  shouldPlay,
  onPlayed,
}: LoginIntroOverlayViewProps) {
  const [phase, setPhase] = useState<IntroPhase>("hidden");
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);

  const dismiss = useCallback(() => {
    setPhase((current) => (current === "playing" ? "leaving" : current));
  }, []);

  const finishDismiss = useCallback(
    (event: TransitionEvent<HTMLButtonElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }

      if (event.propertyName !== DISMISS_TRANSITION_PROPERTY) {
        return;
      }

      setPhase("hidden");
    },
    [],
  );

  useEffect(() => {
    if (!shouldPlay || startedRef.current) {
      return;
    }

    startedRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onPlayed();
      return;
    }

    setPhase("playing");
    onPlayed();
  }, [onPlayed, shouldPlay]);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const onKeyDown = () => {
      dismiss();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, phase]);

  useEffect(() => {
    const video = videoRef.current;

    if (phase !== "playing" || !video) {
      return;
    }

    video.muted = false;

    const playback = video.play();

    if (playback) {
      void playback.catch(() => {
        video.muted = true;
        void video.play();
      });
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }

    videoRef.current?.pause();

    const timeoutId = window.setTimeout(() => {
      setPhase("hidden");
    }, DISMISS_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [phase]);

  if (phase === "hidden") {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={DISMISS_LABEL}
      className={cn(
        "fixed inset-0 z-[200] h-dvh w-screen max-w-none overflow-hidden rounded-none border-0 bg-background p-0 hover:bg-background",
        "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        phase === "leaving" && "pointer-events-none scale-105 opacity-0",
      )}
      onClick={dismiss}
      onTransitionEnd={finishDismiss}
    >
      <video
        ref={videoRef}
        className="size-full object-cover"
        src={LOGIN_INTRO_VIDEO_SRC}
        autoPlay
        playsInline
        disablePictureInPicture
        onEnded={dismiss}
      />
      <span className="sr-only">Click or press any key to continue.</span>
    </Button>
  );
}

/**
 * Plays the login intro when the post-auth redirect includes the welcome flag.
 */
export function LoginIntroOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPlayed = useCallback(() => {
    router.replace(stripLoginIntroPath(pathname, searchParams), { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <LoginIntroOverlayView
      shouldPlay={hasLoginIntroQuery(searchParams)}
      onPlayed={onPlayed}
    />
  );
}
