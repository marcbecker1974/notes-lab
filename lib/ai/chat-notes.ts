import "server-only";

import type { ContextNote } from "./notes-context.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The user's own notes for the chat prompt, newest first, or null if they cannot be
 * read. Documented exception to "all note queries go through lib/notes-db.ts": that
 * module is browser-only (`client-only`). This read uses the request's session cookie,
 * so RLS returns only the signed-in user's rows; no service key, no user id, no writes.
 */
export async function loadNotesForChat(supabase: SupabaseClient): Promise<ContextNote[] | null> {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("title, body")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (error || !data) return null;
    return data.map((row) => ({ title: row.title ?? "", body: row.body ?? "" }));
  } catch {
    return null;
  }
}
