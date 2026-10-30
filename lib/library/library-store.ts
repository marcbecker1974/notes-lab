import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LibraryPage } from "./types.ts";

export class LibraryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryStoreError";
  }
}

const CHUNK_BATCH = 25;

/**
 * Reads and writes of `pages` and `documents` for the signed-in user. Always called with
 * the request's session client, so RLS limits every statement to the user's own rows; the
 * user id is never sent (the database default sets it). The only module that touches
 * these two tables.
 */
export async function listPages(supabase: SupabaseClient): Promise<LibraryPage[] | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("id, title, url, last_fetched_at")
    .order("last_fetched_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (error || !data) return null;
  return data as LibraryPage[];
}

/**
 * Saves one article with its chunks: a new page, or the existing page for the same link
 * with its chunks replaced (a re-fetch). If anything fails after the page row was touched
 * the page is removed again (its chunks go with it by cascade), so the library never holds
 * a page without its chunks. Returns whether an existing page was replaced.
 */
export async function savePage(
  supabase: SupabaseClient,
  page: { title: string; url: string },
  chunks: string[],
  embeddings: number[][],
): Promise<{ replaced: boolean }> {
  if (chunks.length === 0 || chunks.length !== embeddings.length) {
    throw new LibraryStoreError("The article could not be prepared for saving.");
  }
  const failed = () => new LibraryStoreError("The article could not be saved. Please try again.");

  const existing = await supabase.from("pages").select("id").eq("url", page.url).maybeSingle();
  if (existing.error) throw failed();

  let pageId: number;
  const replaced = Boolean(existing.data);
  if (existing.data) {
    pageId = existing.data.id as number;
    const updated = await supabase
      .from("pages")
      .update({ title: page.title, last_fetched_at: new Date().toISOString() })
      .eq("id", pageId);
    if (updated.error) throw failed();
  } else {
    const inserted = await supabase
      .from("pages")
      .insert({ title: page.title, url: page.url, last_fetched_at: new Date().toISOString() })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) throw failed();
    pageId = inserted.data.id as number;
  }

  try {
    if (replaced) {
      const cleared = await supabase.from("documents").delete().eq("page_id", pageId);
      if (cleared.error) throw failed();
    }
    for (let from = 0; from < chunks.length; from += CHUNK_BATCH) {
      const rows = chunks.slice(from, from + CHUNK_BATCH).map((content, i) => ({
        page_id: pageId,
        chunk_index: from + i,
        content,
        embedding: JSON.stringify(embeddings[from + i]),
      }));
      const { error } = await supabase.from("documents").insert(rows);
      if (error) throw failed();
    }
  } catch (error) {
    await supabase.from("pages").delete().eq("id", pageId);
    throw error;
  }
  return { replaced };
}

/** One of the user's own pages by id, or null (not found, or not theirs: RLS hides it). */
export async function getPage(supabase: SupabaseClient, id: number): Promise<{ id: number; title: string; url: string } | null> {
  const { data, error } = await supabase.from("pages").select("id, title, url").eq("id", id).maybeSingle();
  if (error) throw new LibraryStoreError("The article could not be loaded. Please try again.");
  return (data as { id: number; title: string; url: string } | null) ?? null;
}

/**
 * Removes one of the user's own pages; its chunks are deleted by the database (on delete
 * cascade). Returns false when no such page is visible to the user.
 */
export async function deletePage(supabase: SupabaseClient, id: number): Promise<boolean> {
  const { data, error } = await supabase.from("pages").delete().eq("id", id).select("id");
  if (error) throw new LibraryStoreError("The article could not be removed. Please try again.");
  return (data?.length ?? 0) > 0;
}
