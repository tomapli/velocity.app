export const META_CONNECTIONS_API_PATH = "/api/meta/connections";
export const META_OAUTH_MESSAGE_TYPE = "velocity:meta-oauth";
export const META_OAUTH_STATE_COOKIE = "velocity_meta_oauth_state";
export const META_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const META_ACCOUNT_INSIGHT_RANGES_DAYS = [15, 30, 90, 180] as const;
export const META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS = 180;
export const META_ACCOUNT_INSIGHTS_MAX_DAYS = 180;
/** Meta only serves the follower_count day series for the trailing month. */
export const META_FOLLOWER_COUNT_MAX_RANGE_DAYS = 30;
/** Meta rejects day-period insight queries spanning more than ~30 days. */
export const META_ACCOUNT_INSIGHT_WINDOW_DAYS = 30;
/** Minimum age of the last finished Meta run before a page open re-scrapes. */
export const META_ACCOUNT_INSIGHTS_REFRESH_TTL_MS = 60 * 60 * 1_000;
/** An unfinished run untouched this long is abandoned and may be reclaimed. */
export const META_ACCOUNT_INSIGHTS_STUCK_RUN_MS = 10 * 60 * 1_000;
export const META_FETCH_CONCURRENCY = 5;
export const META_MEDIA_PAGE_SIZE = 100;
export const META_TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1_000;

export const META_FACEBOOK_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
] as const;

export const META_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

export const META_ACCOUNT_INSIGHT_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "reposts",
  "follows_and_unfollows",
  "profile_links_taps",
  "follower_demographics",
  "engaged_audience_demographics",
] as const;

export type MetaAccountInsightMetric =
  (typeof META_ACCOUNT_INSIGHT_METRICS)[number];

export const META_ACCOUNT_INSIGHT_SUMMARY_METRICS = [
  "follower_count",
  ...META_ACCOUNT_INSIGHT_METRICS,
] as const;

export type MetaAccountInsightSummaryMetric =
  (typeof META_ACCOUNT_INSIGHT_SUMMARY_METRICS)[number];

export type MetaAccountInsightRangeDays =
  (typeof META_ACCOUNT_INSIGHT_RANGES_DAYS)[number];

export const META_PROFILE_SNAPSHOT_KEY = "profile_snapshot";

export const META_MEDIA_INSIGHT_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "saved",
  "shares",
  "total_interactions",
  "follows",
  "profile_visits",
  "profile_activity",
  "content_views",
  "reposts",
] as const;

export const META_REEL_INSIGHT_METRICS = [
  ...META_MEDIA_INSIGHT_METRICS,
  "ig_reels_video_view_total_time",
  "ig_reels_avg_watch_time",
  "ig_reels_aggregated_all_plays_count",
  "clips_replays_count",
  "reels_skip_rate",
] as const;
