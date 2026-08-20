import { IG_PENDING_SCRAPES_STORAGE_KEY } from "@/lib/ig/constants";

export interface PendingIgScrape {
  username: string;
  isUrlInput: boolean;
}

/**
 * Reads the pending scrape queue from session storage.
 */
export function readPendingIgScrapes(): PendingIgScrape[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(IG_PENDING_SCRAPES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPendingIgScrape);
  } catch {
    return [];
  }
}

/**
 * Appends a pending scrape to the session queue.
 */
export function enqueuePendingIgScrape(entry: PendingIgScrape): PendingIgScrape[] {
  const next = [...readPendingIgScrapes(), entry];
  writePendingIgScrapes(next);
  return next;
}

/**
 * Removes the first matching pending scrape from the queue.
 */
export function dequeuePendingIgScrape(username: string): PendingIgScrape[] {
  const normalized = username.toLowerCase();
  const next = readPendingIgScrapes().filter(
    (entry) => entry.username !== normalized,
  );
  writePendingIgScrapes(next);
  return next;
}

/**
 * Persists the pending scrape queue to session storage.
 */
export function writePendingIgScrapes(entries: PendingIgScrape[]): void {
  if (typeof window === "undefined") {
    return;
  }

  if (entries.length === 0) {
    window.sessionStorage.removeItem(IG_PENDING_SCRAPES_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    IG_PENDING_SCRAPES_STORAGE_KEY,
    JSON.stringify(entries),
  );
}

function isPendingIgScrape(value: unknown): value is PendingIgScrape {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.username === "string" &&
    typeof row.isUrlInput === "boolean"
  );
}
