"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  IG_DEFAULT_REQUESTED_POST_COUNT,
  IG_REQUESTED_POST_COUNT_MAX,
} from "@/lib/ig/constants";

export interface ScrapeParamsConfirmPayload {
  requestedPostCount: number | null;
  sinceWhen: string | null;
}

interface ScrapeParamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  isUrlInput: boolean;
  isSubmitting?: boolean;
  onConfirm: (payload: ScrapeParamsConfirmPayload) => void;
}

type ScrapeParamsMode = "post_count" | "since_when";

/**
 * Collects scrape limits after the user returns from Instagram or pastes a URL.
 */
export function ScrapeParamsDialog({
  open,
  onOpenChange,
  username,
  isUrlInput,
  isSubmitting = false,
  onConfirm,
}: ScrapeParamsDialogProps) {
  const [mode, setMode] = useState<ScrapeParamsMode>("post_count");
  const [postCount, setPostCount] = useState(String(IG_DEFAULT_REQUESTED_POST_COUNT));
  const [sinceWhen, setSinceWhen] = useState("");
  const postCountRef = useRef<HTMLInputElement>(null);
  const sinceWhenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("post_count");
    setPostCount(String(IG_DEFAULT_REQUESTED_POST_COUNT));
    setSinceWhen("");

    const frame = window.requestAnimationFrame(() => {
      postCountRef.current?.focus();
      postCountRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, username]);

  useEffect(() => {
    if (!open || isUrlInput) {
      return;
    }

    const target = mode === "post_count" ? postCountRef.current : sinceWhenRef.current;
    const frame = window.requestAnimationFrame(() => {
      target?.focus();
      target?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, open, isUrlInput]);

  const handleConfirm = () => {
    if (isUrlInput || mode === "post_count") {
      const parsed = Number.parseInt(postCount, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > IG_REQUESTED_POST_COUNT_MAX) {
        postCountRef.current?.focus();
        return;
      }

      onConfirm({ requestedPostCount: parsed, sinceWhen: null });
      return;
    }

    if (!sinceWhen) {
      sinceWhenRef.current?.focus();
      return;
    }

    const sinceIso = new Date(`${sinceWhen}T00:00:00`).toISOString();
    onConfirm({ requestedPostCount: null, sinceWhen: sinceIso });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scrape @{username}</DialogTitle>
          <DialogDescription>
            {isUrlInput
              ? "How many recent posts should we collect?"
              : "Choose a post limit or a start date for this scrape."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <Label htmlFor="ig-post-count">How many posts</Label>
            <Input
              ref={postCountRef}
              id="ig-post-count"
              type="number"
              min={1}
              max={IG_REQUESTED_POST_COUNT_MAX}
              value={postCount}
              onChange={(event) => {
                setMode("post_count");
                setPostCount(event.target.value);
              }}
              onFocus={() => setMode("post_count")}
              disabled={isSubmitting}
            />
          </div>

          {!isUrlInput ? (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  or
                </span>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ig-since-when">Since when</Label>
                <Input
                  ref={sinceWhenRef}
                  id="ig-since-when"
                  type="date"
                  value={sinceWhen}
                  onChange={(event) => {
                    setMode("since_when");
                    setSinceWhen(event.target.value);
                  }}
                  onFocus={() => setMode("since_when")}
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Scheduling…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
