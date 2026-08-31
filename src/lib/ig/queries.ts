import type { SupabaseClient } from "@supabase/supabase-js";

import { buildIgScrapeJobs, type IgScrapeJob } from "@/lib/ig/groups";
import {
  IG_POSTS_EXPORT_PAGE_SIZE,
  IG_POSTS_PAGE_SIZE,
} from "@/lib/ig/constants";
import type { IgMediaType, IgPostSortKey } from "@/lib/ig/metrics";
import { deduplicateIgPostsByShortcode } from "@/lib/ig/post-identity";
import type { Database } from "@/lib/supabase/database.types";
import { throwQueryError } from "@/lib/supabase/throw-query-error";
import type { Tables } from "@/lib/supabase/tables";

export type IgProfile = Tables<"ig_profiles">;
export type Group = Tables<"groups">;
export type ScheduledScrape = Tables<"scheduled_scrapes">;
export type IgPost = Tables<"ig_posts">;
export type IgAccountInsights = Tables<"ig_account_insights">;

export type IgPostListItem = Pick<
  IgPost,
  | "id"
  | "ig_profile_id"
  | "uploaded_at"
  | "thumbnail_url"
  | "post_url"
  | "first_frame_url"
  | "video_embed_url"
  | "media_type"
  | "video_length_secs"
  | "view_count"
  | "save_count"
  | "share_count"
  | "comment_count"
  | "like_count"
  | "follows_count"
  | "reach_count"
  | "hook_rate"
  | "average_watch_time_ms"
  | "hold_rate"
  | "description"
>;

export interface IgPostsPage {
  posts: IgPostListItem[];
  hasMore: boolean;
  nextOffset: number;
}

export type IgPostSortDirection = "asc" | "desc";

/** Sort and filter parameters applied in the database, not on loaded rows. */
export interface IgPostsListQuery {
  sortKey?: IgPostSortKey;
  sortDirection?: IgPostSortDirection;
  mediaTypes?: readonly IgMediaType[];
}

export interface IgPostsPageOptions extends IgPostsListQuery {
  offset?: number;
  pageSize?: number;
}

export const IG_POSTS_DEFAULT_SORT_KEY: IgPostSortKey = "uploaded_at";
export const IG_POSTS_DEFAULT_SORT_DIRECTION: IgPostSortDirection = "desc";

/**
 * Maps each sort key to the `ig_posts` column PostgREST orders by. Derived
 * metrics are stored generated columns (see `db/schema/ig-posts.ts`).
 */
const IG_POST_SORT_COLUMNS: Record<IgPostSortKey, string> = {
  uploaded_at: "uploaded_at",
  video_length_secs: "video_length_secs",
  view_count: "view_count",
  like_count: "like_count",
  comment_count: "comment_count",
  save_count: "save_count",
  share_count: "share_count",
  follows_count: "follows_count",
  follows_per_1k_views: "follows_per_1k_views",
  reach_count: "reach_count",
  hook_rate: "hook_rate",
  average_watch_time_ms: "average_watch_time_ms",
  hold_rate: "hold_rate",
  description_length: "description_length",
  er: "engagement_rate",
  weighted_er: "weighted_engagement_rate",
  save_rate: "save_rate",
  share_rate: "share_rate",
  comment_rate: "comment_rate",
  like_rate: "like_rate",
};

const IG_POST_LIST_COLUMNS = `
  id,
  ig_profile_id,
  uploaded_at,
  thumbnail_url,
  post_url,
  first_frame_url,
  video_embed_url,
  media_type,
  video_length_secs,
  view_count,
  save_count,
  share_count,
  comment_count,
  like_count,
  follows_count,
  reach_count,
  hook_rate,
  average_watch_time_ms,
  hold_rate,
  description
` as const;

export interface ScheduleIgScrapeParams {
  igUsername: string;
  startedBy: string;
  requestedPostCount?: number | null;
  sinceWhen?: string | null;
}

/** Every workspace profile, scrape (group), and request (scheduled scrape). */
export interface IgScrapeSnapshot {
  groups: Group[];
  scrapes: ScheduledScrape[];
  profiles: IgProfile[];
}

/**
 * Loads the raw rows behind the home profile list and the scrapes manager so
 * clients can keep them in sync through realtime broadcasts.
 */
export async function loadIgScrapeSnapshot(
  supabase: SupabaseClient<Database>,
): Promise<IgScrapeSnapshot> {
  const [
    { data: groups, error: groupsError },
    { data: scrapes, error: scrapesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
    supabase.from("scheduled_scrapes").select("*"),
    supabase.from("ig_profiles").select("*"),
  ]);

  if (groupsError) {
    return throwQueryError(groupsError);
  }
  if (scrapesError) {
    return throwQueryError(scrapesError);
  }
  if (profilesError) {
    return throwQueryError(profilesError);
  }

  return {
    groups: groups ?? [],
    scrapes: scrapes ?? [],
    profiles: profiles ?? [],
  };
}

/**
 * Loads group rows for scrape history with their profiles and scheduled runs.
 */
export async function listIgScrapeJobs(
  supabase: SupabaseClient<Database>,
): Promise<IgScrapeJob[]> {
  const snapshot = await loadIgScrapeSnapshot(supabase);

  return buildIgScrapeJobs(
    snapshot.groups,
    snapshot.scrapes,
    new Map(snapshot.profiles.map((profile) => [profile.id, profile])),
  );
}

/**
 * Loads one scrape (group) with its profile and requests, or null when missing.
 */
export async function getIgScrapeJobById(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<IgScrapeJob | null> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    return throwQueryError(groupError);
  }
  if (!group) {
    return null;
  }

  const [
    { data: profile, error: profileError },
    { data: scrapes, error: scrapesError },
  ] = await Promise.all([
    supabase.from("ig_profiles").select("*").eq("id", group.ig_profile_id).maybeSingle(),
    supabase.from("scheduled_scrapes").select("*").eq("group_id", group.id),
  ]);

  if (profileError) {
    return throwQueryError(profileError);
  }
  if (scrapesError) {
    return throwQueryError(scrapesError);
  }
  if (!profile) {
    return null;
  }

  return (
    buildIgScrapeJobs([group], scrapes ?? [], new Map([[profile.id, profile]]))[0] ?? null
  );
}

/**
 * Loads a profile by Instagram username.
 */
export async function getIgProfileByUsername(
  supabase: SupabaseClient<Database>,
  username: string,
): Promise<IgProfile | null> {
  const { data, error } = await supabase
    .from("ig_profiles")
    .select("*")
    .eq("ig_username", username.toLowerCase())
    .maybeSingle();

  if (error) {
    return throwQueryError(error);
  }

  return data;
}

/**
 * Loads the latest scrape job for a username.
 */
export async function getLatestIgScrapeJobForUsername(
  supabase: SupabaseClient<Database>,
  username: string,
): Promise<IgScrapeJob | null> {
  const profile = await getIgProfileByUsername(supabase, username);
  if (!profile) {
    return null;
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("ig_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (groupError) {
    return throwQueryError(groupError);
  }
  if (!group) {
    return null;
  }

  const { data: scrapes, error: scrapesError } = await supabase
    .from("scheduled_scrapes")
    .select("*")
    .eq("group_id", group.id);

  if (scrapesError) {
    return throwQueryError(scrapesError);
  }

  return buildIgScrapeJobs(
    [group],
    scrapes ?? [],
    new Map([[profile.id, profile]]),
  )[0] ?? null;
}

/**
 * Loads one lightweight page of profile posts, sorted and filtered in the
 * database so every page reflects the whole profile, not just loaded rows.
 * Omitted metric values always sort last; ties fall back to newest upload.
 */
export async function listIgPostsPageForProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
  {
    offset = 0,
    pageSize = IG_POSTS_PAGE_SIZE,
    sortKey = IG_POSTS_DEFAULT_SORT_KEY,
    sortDirection = IG_POSTS_DEFAULT_SORT_DIRECTION,
    mediaTypes = [],
  }: IgPostsPageOptions = {},
): Promise<IgPostsPage> {
  const sortColumn = IG_POST_SORT_COLUMNS[sortKey];
  let query = supabase
    .from("ig_posts")
    .select(IG_POST_LIST_COLUMNS)
    .eq("ig_profile_id", profileId);

  if (mediaTypes.length > 0) {
    query = query.in("media_type", [...mediaTypes]);
  }

  query = query.order(sortColumn, {
    ascending: sortDirection === "asc",
    nullsFirst: false,
  });
  if (sortColumn !== IG_POST_SORT_COLUMNS.uploaded_at) {
    query = query.order("uploaded_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query
    .order("id", { ascending: false })
    .range(offset, offset + pageSize);

  if (error) {
    return throwQueryError(error);
  }

  const rows: IgPostListItem[] = data ?? [];
  const pageRows = rows.slice(0, pageSize);

  return {
    posts: deduplicateIgPostsByShortcode(pageRows),
    hasMore: rows.length > pageSize,
    nextOffset: offset + pageRows.length,
  };
}

/**
 * Loads every lightweight post page for explicit full-dataset actions such as CSV export.
 */
export async function listIgPostsForProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
  listQuery: IgPostsListQuery = {},
): Promise<IgPostListItem[]> {
  const posts: IgPostListItem[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await listIgPostsPageForProfile(supabase, profileId, {
      ...listQuery,
      offset,
      pageSize: IG_POSTS_EXPORT_PAGE_SIZE,
    });
    posts.push(...page.posts);
    offset = page.nextOffset;
    hasMore = page.hasMore;
  }

  return deduplicateIgPostsByShortcode(posts);
}

/** Loads every private account-insight range snapshot available for a group. */
export async function listIgAccountInsightsForGroup(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<IgAccountInsights[]> {
  const { data, error } = await supabase
    .from("ig_account_insights")
    .select("*")
    .eq("group_id", groupId)
    .order("period_days", { ascending: true });
  if (error) {
    return throwQueryError(error);
  }
  return data ?? [];
}

/** Loads one account-insight window so large range snapshots can be fetched on demand. */
export async function getIgAccountInsightsForGroupPeriod(
  supabase: SupabaseClient<Database>,
  groupId: string,
  periodDays: number,
): Promise<IgAccountInsights | null> {
  const { data, error } = await supabase
    .from("ig_account_insights")
    .select("*")
    .eq("group_id", groupId)
    .eq("period_days", periodDays)
    .maybeSingle();
  if (error) {
    return throwQueryError(error);
  }
  return data;
}

/**
 * Loads a post that belongs to the given Instagram username.
 */
export async function getIgPostForUsername(
  supabase: SupabaseClient<Database>,
  username: string,
  postId: string,
): Promise<IgPost | null> {
  const profile = await getIgProfileByUsername(supabase, username);
  if (!profile) {
    return null;
  }

  const { data, error } = await supabase
    .from("ig_posts")
    .select("*")
    .eq("id", postId)
    .eq("ig_profile_id", profile.id)
    .maybeSingle();

  if (error) {
    return throwQueryError(error);
  }

  return data;
}

/**
 * Finds or creates a shared profile row for the username.
 */
export async function upsertIgProfile(
  supabase: SupabaseClient<Database>,
  params: { igUsername: string; createdBy: string },
): Promise<IgProfile> {
  const username = params.igUsername.toLowerCase();
  const existing = await getIgProfileByUsername(supabase, username);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("ig_profiles")
    .insert({
      ig_username: username,
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    const raced = await getIgProfileByUsername(supabase, username);
    if (raced) {
      return raced;
    }

    return throwQueryError(error);
  }

  return data;
}
