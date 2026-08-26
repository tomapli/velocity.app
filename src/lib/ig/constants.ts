export const IG_SCRAPES_REALTIME_TOPIC = "public:scheduled_scrapes";

export const IG_GROUPS_REALTIME_TOPIC = "public:groups";

export const IG_PROFILES_REALTIME_TOPIC = "public:ig_profiles";

export const IG_SCRAPES_REALTIME_EVENTS = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export const IG_USERNAME_MAX_LENGTH = 30;

export const IG_USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

export const IG_POST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const IG_MEDIA_TYPES = ["static", "short", "carousel"] as const;

export const IG_INSTAGRAM_ORIGIN = "https://www.instagram.com";

export const IG_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export const IG_PENDING_SCRAPES_STORAGE_KEY = "velocity:pending-ig-scrapes";

export const IG_DEFAULT_REQUESTED_POST_COUNT = 12;

export const IG_REQUESTED_POST_COUNT_MAX = 500;

export const IG_POSTS_PAGE_SIZE = 25;

export const IG_POSTS_EXPORT_PAGE_SIZE = 500;
