"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type IgSearchOption,
  type IgSearchProfileOption,
  buildIgSearchOptions,
} from "@/lib/ig/search-options";
import { cn } from "@/lib/utils";

interface CopilotSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: IgSearchOption) => void;
  profiles: IgSearchProfileOption[];
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Center-stage Instagram search bar with gradient shell and typeahead options.
 */
export function CopilotSearchBar({
  value,
  onChange,
  onSelect,
  profiles,
  disabled = false,
  placeholder = "Instagram username or profile URL",
}: CopilotSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const options = buildIgSearchOptions(value, profiles);
  const showOptions = isOpen && !disabled && options.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

  const selectOption = (option: IgSearchOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const option = options[activeIndex] ?? options[0];
    if (option) {
      selectOption(option);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showOptions) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div className="copilot-gradient-shell relative p-5">
        <div
          className={cn(
            "relative cursor-pointer",
            "origin-center transition-transform duration-200 ease-out",
            !showOptions && "hover:scale-[1.04]",
            "motion-reduce:transition-none motion-reduce:hover:scale-100",
          )}
        >
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
            <div className="relative z-10 flex cursor-pointer items-center rounded-[calc(2rem-3px)] bg-background px-4 py-3 sm:px-5 sm:py-4">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => {
                  onChange(event.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => {
                  // Defer so option click can fire before the list unmounts.
                  window.setTimeout(() => setIsOpen(false), 120);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={showOptions}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showOptions ? `${listId}-option-${activeIndex}` : undefined
                }
                aria-label="Instagram username or profile URL"
                className={cn(
                  "min-w-0 flex-1 cursor-pointer bg-transparent text-base outline-none sm:text-lg",
                  "placeholder:text-muted-foreground/80",
                  "disabled:cursor-not-allowed",
                )}
              />
            </div>
          </div>

          {showOptions ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search options"
              className="absolute inset-x-0 top-[calc(100%-0.75rem)] z-20 overflow-hidden rounded-2xl border bg-background shadow-lg"
            >
              {options.map((option, index) => {
                const isActive = index === activeIndex;

                return (
                  <li key={option.id} role="presentation">
                    <Button
                      id={`${listId}-option-${index}`}
                      type="button"
                      role="option"
                      variant="ghost"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left",
                        isActive && "bg-accent text-accent-foreground",
                      )}
                    >
                      {option.kind === "new" ? (
                        <Plus className="size-4 shrink-0 text-chart-4" aria-hidden />
                      ) : (
                        <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          @{option.username}
                        </span>
                        {option.kind === "existing" && option.displayName ? (
                          <span className="block truncate text-sm text-muted-foreground">
                            {option.displayName}
                          </span>
                        ) : null}
                        {option.kind === "new" ? (
                          <span className="block text-sm text-muted-foreground">
                            Start a new scrape
                          </span>
                        ) : null}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          option.kind === "new" &&
                            "border-chart-4/40 bg-chart-4/10 text-chart-4",
                          option.kind === "existing" &&
                            option.exact &&
                            "border-success/40 bg-success/10 text-success-strong",
                        )}
                      >
                        {option.kind === "new"
                          ? "New"
                          : option.exact
                            ? "Exact match"
                            : "Existing"}
                      </Badge>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </form>
  );
}
