import type { Database } from "@/lib/supabase/database.types";
import type { IgPost } from "@/lib/ig/queries";

export type IgMediaType = Database["public"]["Enums"]["ig_post_media_type"];
export type MetricTone = "pass" | "near" | "miss" | "neutral";
export type IgPostSortKey =
  | "uploaded_at"
  | "video_length_secs"
  | "view_count"
  | "like_count"
  | "comment_count"
  | "save_count"
  | "share_count"
  | "description_length"
  | "er"
  | "weighted_er"
  | "save_rate"
  | "share_rate"
  | "comment_rate"
  | "like_rate";

export interface ScoredValue {
  value: number;
  formatted: string;
  tone: MetricTone;
  targetLabel: string;
}

export interface IgPostMetrics {
  descriptionLength: number | null;
  unweightedEr: ScoredValue | null;
  weightedEr: ScoredValue | null;
  saveRate: ScoredValue | null;
  shareRate: ScoredValue | null;
  commentRate: ScoredValue | null;
  likeRate: ScoredValue | null;
  videoLength: ScoredValue | null;
  descriptionLengthScore: ScoredValue | null;
}

export const IG_UNWEIGHTED_ER_TARGET = 5;
export const IG_WEIGHTED_ER_TARGET = 10;
export const IG_SAVE_RATE_TARGET = 2;
export const IG_SHARE_RATE_TARGET = 2;
export const IG_DESCRIPTION_LENGTH_MIN = 300;
export const IG_DESCRIPTION_LENGTH_MAX = 700;
export const IG_VIDEO_LENGTH_MIN_SECS = 5;
export const IG_VIDEO_LENGTH_MAX_SECS = 60;

export const IG_SAVE_WEIGHT = 4;
export const IG_SHARE_WEIGHT = 3;
export const IG_COMMENT_WEIGHT = 2;
export const IG_LIKE_WEIGHT = 1;

export const IG_NEAR_RATIO = 0.7;

export const MEDIA_TYPE_LABELS: Record<IgMediaType, string> = {
  carousel: "Carousel",
  short: "Short",
  static: "Static",
};

export const IG_POST_SORT_OPTIONS: { key: IgPostSortKey; label: string }[] = [
  { key: "uploaded_at", label: "Upload date" },
  { key: "video_length_secs", label: "Video length" },
  { key: "view_count", label: "Views" },
  { key: "like_count", label: "Likes" },
  { key: "comment_count", label: "Comments" },
  { key: "save_count", label: "Saves" },
  { key: "share_count", label: "Shares" },
  { key: "er", label: "ER" },
  { key: "weighted_er", label: "Weighted ER" },
  { key: "save_rate", label: "Save rate" },
  { key: "share_rate", label: "Share rate" },
  { key: "comment_rate", label: "Comment rate" },
  { key: "like_rate", label: "Like rate" },
  { key: "description_length", label: "Description length" },
];

const COUNT_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Derives rates and color tones from a stored Instagram post.
 * Omitted source fields stay omitted — they are never filled with zeros.
 */
export function getIgPostMetrics(post: IgPost): IgPostMetrics {
  const descriptionLength = post.description == null ? null : post.description.length;
  const views = post.view_count;
  const canRate = views != null && views > 0;

  return {
    descriptionLength,
    unweightedEr: canRate ? scoreUnweightedEr(post, views) : null,
    weightedEr: canRate ? scoreWeightedEr(post, views) : null,
    saveRate: canRate ? scoreRate(post.save_count, views, IG_SAVE_RATE_TARGET, "≥ 2%") : null,
    shareRate: canRate ? scoreRate(post.share_count, views, IG_SHARE_RATE_TARGET, "≥ 2%") : null,
    commentRate: canRate ? scoreRate(post.comment_count, views, null, null) : null,
    likeRate: canRate ? scoreRate(post.like_count, views, null, null) : null,
    videoLength: scoreVideoLength(post.video_length_secs),
    descriptionLengthScore: scoreDescriptionLength(descriptionLength),
  };
}

/**
 * Returns a comparable numeric value for table sorting.
 */
export function getIgPostSortValue(post: IgPost, key: IgPostSortKey): number | null {
  const metrics = getIgPostMetrics(post);

  switch (key) {
    case "uploaded_at":
      return post.uploaded_at ? Date.parse(post.uploaded_at) : null;
    case "video_length_secs":
      return post.video_length_secs;
    case "view_count":
      return post.view_count;
    case "like_count":
      return post.like_count;
    case "comment_count":
      return post.comment_count;
    case "save_count":
      return post.save_count;
    case "share_count":
      return post.share_count;
    case "description_length":
      return metrics.descriptionLength;
    case "er":
      return metrics.unweightedEr?.value ?? null;
    case "weighted_er":
      return metrics.weightedEr?.value ?? null;
    case "save_rate":
      return metrics.saveRate?.value ?? null;
    case "share_rate":
      return metrics.shareRate?.value ?? null;
    case "comment_rate":
      return metrics.commentRate?.value ?? null;
    case "like_rate":
      return metrics.likeRate?.value ?? null;
  }
}

/**
 * Sorts posts by a metric, sending omitted values to the end.
 */
export function sortIgPosts(
  posts: IgPost[],
  key: IgPostSortKey,
  direction: "asc" | "desc",
): IgPost[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...posts].sort((left, right) => {
    const leftValue = getIgPostSortValue(left, key);
    const rightValue = getIgPostSortValue(right, key);

    if (leftValue == null && rightValue == null) {
      return (right.uploaded_at ?? "").localeCompare(left.uploaded_at ?? "");
    }
    if (leftValue == null) {
      return 1;
    }
    if (rightValue == null) {
      return -1;
    }
    if (leftValue === rightValue) {
      return (right.uploaded_at ?? "").localeCompare(left.uploaded_at ?? "");
    }

    return leftValue < rightValue ? -sign : sign;
  });
}

/**
 * Filters posts to the selected media types. An empty selection shows every type.
 */
export function filterIgPostsByMediaType(
  posts: IgPost[],
  mediaTypes: readonly IgMediaType[],
): IgPost[] {
  if (mediaTypes.length === 0) {
    return posts;
  }

  const allowed = new Set(mediaTypes);
  return posts.filter(
    (post) => post.media_type != null && allowed.has(post.media_type),
  );
}

export function formatCount(value: number | null): string | null {
  return value == null ? null : COUNT_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  return `${PERCENT_FORMATTER.format(value)}%`;
}

export function formatUploadedAt(iso: string | null): string {
  if (!iso) {
    return "Unknown";
  }

  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? iso : DATE_FORMATTER.format(parsed);
}

export function formatVideoLength(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function metricToneClassName(tone: MetricTone): string {
  switch (tone) {
    case "pass":
      return "bg-success/10 text-success-strong";
    case "near":
      return "bg-warning/10 text-warning-strong";
    case "miss":
      return "bg-destructive/10 text-destructive";
    case "neutral":
      return "bg-muted text-foreground";
  }
}

/**
 * Builds a CSV document from visible post fields. Omitted values stay empty cells.
 */
export function postsToCsv(posts: IgPost[]): string {
  const headers = [
    "Date of upload",
    "Thumbnail",
    "URL",
    "First frame",
    "Video URL",
    "Media type",
    "Video length (s)",
    "Views",
    "Saves",
    "Shares",
    "Comments",
    "Likes",
    "Description",
    "Description length",
    "ER %",
    "Weighted ER %",
    "Save rate %",
    "Share rate %",
    "Comment rate %",
    "Like rate %",
  ];

  const rows = posts.map((post) => {
    const metrics = getIgPostMetrics(post);
    return [
      post.uploaded_at ?? "",
      post.thumbnail_url ?? "",
      post.post_url,
      post.first_frame_url ?? "",
      post.video_embed_url ?? "",
      post.media_type ?? "",
      post.video_length_secs ?? "",
      post.view_count ?? "",
      post.save_count ?? "",
      post.share_count ?? "",
      post.comment_count ?? "",
      post.like_count ?? "",
      post.description ?? "",
      metrics.descriptionLength ?? "",
      metrics.unweightedEr?.value ?? "",
      metrics.weightedEr?.value ?? "",
      metrics.saveRate?.value ?? "",
      metrics.shareRate?.value ?? "",
      metrics.commentRate?.value ?? "",
      metrics.likeRate?.value ?? "",
    ].map(csvCell);
  });

  return [headers.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function scoreUnweightedEr(post: IgPost, views: number): ScoredValue | null {
  const engagements = [post.like_count, post.comment_count, post.save_count, post.share_count];
  if (engagements.every((value) => value == null)) {
    return null;
  }

  const total = engagements.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return scoreAgainstMin((total / views) * 100, IG_UNWEIGHTED_ER_TARGET, "≥ 5%");
}

function scoreWeightedEr(post: IgPost, views: number): ScoredValue | null {
  const engagements = [post.like_count, post.comment_count, post.save_count, post.share_count];
  if (engagements.every((value) => value == null)) {
    return null;
  }

  const weighted =
    (post.save_count ?? 0) * IG_SAVE_WEIGHT +
    (post.share_count ?? 0) * IG_SHARE_WEIGHT +
    (post.comment_count ?? 0) * IG_COMMENT_WEIGHT +
    (post.like_count ?? 0) * IG_LIKE_WEIGHT;

  return scoreAgainstMin((weighted / views) * 100, IG_WEIGHTED_ER_TARGET, "≥ 10%");
}

function scoreRate(
  count: number | null,
  views: number,
  target: number | null,
  targetLabel: string | null,
): ScoredValue | null {
  if (count == null) {
    return null;
  }

  const value = (count / views) * 100;
  if (target == null || targetLabel == null) {
    return {
      value,
      formatted: formatPercent(value),
      tone: "neutral",
      targetLabel: "",
    };
  }

  return scoreAgainstMin(value, target, targetLabel);
}

function scoreAgainstMin(value: number, target: number, targetLabel: string): ScoredValue {
  const tone: MetricTone =
    value >= target ? "pass" : value >= target * IG_NEAR_RATIO ? "near" : "miss";

  return {
    value,
    formatted: formatPercent(value),
    tone,
    targetLabel,
  };
}

function scoreVideoLength(seconds: number | null): ScoredValue | null {
  if (seconds == null) {
    return null;
  }

  const nearFloor = IG_VIDEO_LENGTH_MIN_SECS * IG_NEAR_RATIO;
  const nearCeiling = IG_VIDEO_LENGTH_MAX_SECS / IG_NEAR_RATIO;
  let tone: MetricTone = "miss";
  if (seconds >= IG_VIDEO_LENGTH_MIN_SECS && seconds <= IG_VIDEO_LENGTH_MAX_SECS) {
    tone = "pass";
  } else if (seconds >= nearFloor && seconds <= nearCeiling) {
    tone = "near";
  }

  return {
    value: seconds,
    formatted: formatVideoLength(seconds),
    tone,
    targetLabel: "5–60s",
  };
}

function scoreDescriptionLength(length: number | null): ScoredValue | null {
  if (length == null) {
    return null;
  }

  const nearMin = IG_DESCRIPTION_LENGTH_MIN * IG_NEAR_RATIO;
  const nearMax = IG_DESCRIPTION_LENGTH_MAX / IG_NEAR_RATIO;
  let tone: MetricTone = "miss";
  if (length >= IG_DESCRIPTION_LENGTH_MIN && length <= IG_DESCRIPTION_LENGTH_MAX) {
    tone = "pass";
  } else if (length >= nearMin && length <= nearMax) {
    tone = "near";
  }

  return {
    value: length,
    formatted: COUNT_FORMATTER.format(length),
    tone,
    targetLabel: "≈ 300–700",
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
