const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export const IG_EMPTY_VALUE = "—";

/** Formats an ISO timestamp as a local date and time, or a dash when missing. */
export function formatIgDateTime(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return IG_EMPTY_VALUE;
  }
  return DATE_TIME_FORMATTER.format(parsed);
}

/** Formats an ISO timestamp as a local date only, or a dash when missing. */
export function formatIgDate(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return IG_EMPTY_VALUE;
  }
  return DATE_FORMATTER.format(parsed);
}

/** Formats the elapsed time between two ISO timestamps, e.g. `2m 13s`. */
export function formatIgDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const startMs = start ? Date.parse(start) : Number.NaN;
  const endMs = end ? Date.parse(end) : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  const totalSeconds = Math.round((endMs - startMs) / MILLISECONDS_PER_SECOND);
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor(
    (totalSeconds % (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
