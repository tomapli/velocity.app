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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div className="copilot-gradient-shell rounded-[2rem] p-1 shadow-lg">
        <div className="relative z-10 flex items-center gap-2 rounded-[calc(2rem-4px)] bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
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
            className={cn(
              "size-10 shrink-0 cursor-pointer rounded-full bg-primary text-primary-foreground shadow-md",
              "transition-[transform,box-shadow] duration-150 ease-out",
              "hover:scale-125 hover:bg-primary/90 hover:shadow-xl",
              "active:scale-110 active:cursor-pointer",
              "disabled:cursor-not-allowed",
              "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
            )}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
