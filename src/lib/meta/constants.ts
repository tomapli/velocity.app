export const META_CONNECTIONS_API_PATH = "/api/meta/connections";
export const META_OAUTH_MESSAGE_TYPE = "velocity:meta-oauth";
export const META_OAUTH_STATE_COOKIE = "velocity_meta_oauth_state";
export const META_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const META_ACCOUNT_INSIGHTS_DAYS = 90;
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
  "follower_count",
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
  "profile_views",
  "profile_links_taps",
  "website_clicks",
  "online_followers",
  "follower_demographics",
  "reached_audience_demographics",
  "engaged_audience_demographics",
  "content_views",
] as const;

export type MetaAccountInsightMetric =
  (typeof META_ACCOUNT_INSIGHT_METRICS)[number];

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

