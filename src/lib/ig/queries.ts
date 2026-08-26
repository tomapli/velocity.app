import type { SupabaseClient } from "@supabase/supabase-js";

import { buildIgScrapeJobs, type IgScrapeJob } from "@/lib/ig/groups";
import {
  IG_POSTS_EXPORT_PAGE_SIZE,
  IG_POSTS_PAGE_SIZE,
} from "@/lib/ig/constants";
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

/**
 * Loads group rows for scrape history with their profiles and scheduled runs.
 */
export async function listIgScrapeJobs(
  supabase: SupabaseClient<Database>,
): Promise<IgScrapeJob[]> {
  const [
    { data: groups, error: groupsError },
    { data: scrapes, error: scrapesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase
        .from("scheduled_scrapes")
        .select("*"),
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

  return buildIgScrapeJobs(
    groups ?? [],
    scrapes ?? [],
    new Map((profiles ?? []).map((profile) => [profile.id, profile])),
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

/** Loads one lightweight page of profile posts, newest upload first. */
export async function listIgPostsPageForProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
  offset = 0,
  pageSize = IG_POSTS_PAGE_SIZE,
): Promise<IgPostsPage> {
  const { data, error } = await supabase
    .from("ig_posts")
    .select(IG_POST_LIST_COLUMNS)
    .eq("ig_profile_id", profileId)
    .order("uploaded_at", { ascending: false })
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
): Promise<IgPostListItem[]> {
  const posts: IgPostListItem[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await listIgPostsPageForProfile(
      supabase,
      profileId,
      offset,
      IG_POSTS_EXPORT_PAGE_SIZE,
    );
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
