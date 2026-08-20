import type { SupabaseClient } from "@supabase/supabase-js";

import { groupScheduledScrapes, type IgScrapeJob } from "@/lib/ig/groups";
import type { Database } from "@/lib/supabase/database.types";
import { throwQueryError } from "@/lib/supabase/throw-query-error";
import type { Tables } from "@/lib/supabase/tables";

export type IgProfile = Tables<"ig_profiles">;
export type ScheduledScrape = Tables<"scheduled_scrapes">;
export type IgPost = Tables<"ig_posts">;

export interface ScheduleIgScrapeParams {
  igUsername: string;
  startedBy: string;
  requestedPostCount?: number | null;
  sinceWhen?: string | null;
}

/**
 * Loads every scheduled scrape with its profile, grouped into jobs.
 */
export async function listIgScrapeJobs(
  supabase: SupabaseClient<Database>,
): Promise<IgScrapeJob[]> {
  const [{ data: scrapes, error: scrapesError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from("scheduled_scrapes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("ig_profiles").select("*"),
    ]);

  if (scrapesError) {
    return throwQueryError(scrapesError);
  }
  if (profilesError) {
    return throwQueryError(profilesError);
  }

  return groupScheduledScrapes(
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

  const { data, error } = await supabase
    .from("scheduled_scrapes")
    .select("*")
    .eq("ig_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return throwQueryError(error);
  }

  return groupScheduledScrapes(data ?? [], new Map([[profile.id, profile]]))[0] ?? null;
}

/**
 * Loads detailed posts for a profile, newest upload first.
 */
export async function listIgPostsForProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<IgPost[]> {
  const { data, error } = await supabase
    .from("ig_posts")
    .select("*")
    .eq("ig_profile_id", profileId)
    .not("details_scrape_id", "is", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return throwQueryError(error);
  }

  return data ?? [];
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
