import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

export type Item = Tables<"items">;

/**
 * Loads all items, newest first.
 */
export async function listItems(
  supabase: SupabaseClient<Database>,
): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Inserts an item owned by the given auth user.
 */
export async function createItem(
  supabase: SupabaseClient<Database>,
  params: { title: string; createdBy: string },
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert({
      title: params.title,
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Deletes an item by id. Any authenticated user may delete any row.
 */
export async function deleteItem(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
