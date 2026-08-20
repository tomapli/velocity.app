"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopilotSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Center-stage Instagram search bar with a colorful gradient shell and auto-focus.
 */
export function CopilotSearchBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Instagram username or profile URL",
}: CopilotSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = !disabled && value.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      {/* Extra padding so the blurred aura can bleed without being clipped by parents. */}
      <div className="copilot-gradient-shell relative p-5">
        <div
          className={cn(
            "relative cursor-pointer",
            "origin-center transition-transform duration-200 ease-out",
            "hover:scale-[1.04]",
            "motion-reduce:transition-none motion-reduce:hover:scale-100",
          )}
        >
          {/*
            Aura = same spinning ring as the border (square + punched center),
            stacked under the sharp ring and blurred. No negative z-index —
            that disappears under a stacking context.
          */}
          <div
            className="copilot-gradient-aura pointer-events-none absolute -inset-2"
            aria-hidden
          >
            <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] p-1.5">
              <div className="copilot-gradient copilot-gradient-spin-layer copilot-gradient-rotate" />
              <div className="relative h-full w-full rounded-[calc(2.25rem-6px)] bg-background" />
            </div>
          </div>

          <div className="copilot-gradient-ring relative z-10 rounded-[2rem] p-[3px] shadow-lg">
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
              aria-hidden
            >
              <div className="copilot-gradient copilot-gradient-spin-layer copilot-gradient-rotate" />
            </div>
            <div className="relative z-10 flex cursor-pointer items-center gap-2 rounded-[calc(2rem-3px)] bg-background px-4 py-3 sm:px-5 sm:py-4">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                aria-label="Instagram username or profile URL"
                className={cn(
                  "min-w-0 flex-1 cursor-pointer bg-transparent text-base outline-none sm:text-lg",
                  "placeholder:text-muted-foreground/80",
                  "disabled:cursor-not-allowed",
                )}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit}
                aria-label="Search Instagram profile"
                className={cn(
                  "size-10 shrink-0 cursor-pointer rounded-full bg-primary text-primary-foreground shadow-md",
                  "hover:bg-primary/90",
                  "disabled:cursor-not-allowed",
                )}
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
