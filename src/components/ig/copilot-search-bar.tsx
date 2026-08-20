"use client";

import { useEffect, useRef } from "react";
import { Search, Sparkles } from "lucide-react";

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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div
        className={cn(
          "relative rounded-[2rem] p-[2px] shadow-lg",
          "bg-[linear-gradient(135deg,var(--chart-2),var(--chart-3),var(--chart-4),var(--voltage))]",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:opacity-60 before:blur-xl",
          "before:bg-[linear-gradient(135deg,var(--chart-2),var(--chart-3),var(--chart-4),var(--voltage))]",
        )}
      >
        <div className="relative flex items-center gap-2 rounded-[calc(2rem-2px)] bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
          <Sparkles
            className="size-5 shrink-0 text-chart-3-strong sm:size-6"
            aria-hidden
          />
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
              "min-w-0 flex-1 bg-transparent text-base outline-none sm:text-lg",
              "placeholder:text-muted-foreground/80",
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={disabled || value.trim().length === 0}
            aria-label="Search Instagram profile"
            className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
