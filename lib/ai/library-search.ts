import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Passage, SearchLibrary } from "./library-tool.ts";
import { getEmbeddings } from "./openrouter.ts";

/** Weaker matches than this are not returned at all; the model sees the score of the rest. */
export const MATCH_THRESHOLD = 0.25;
export const MATCH_COUNT = 6;

/**
 * The search the model's tool call runs. It embeds the query (same fixed model as the
 * stored chunks) and calls match_documents with the REQUEST's session client, so the
 * database itself limits the result to the signed-in user's chunks. The model supplies
 * the query text only: no user id, no table name, nothing else reaches the database.
 */
export function makeLibrarySearch(supabase: SupabaseClient): SearchLibrary {
  return async (query) => {
    const [vector] = await getEmbeddings([query]);
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: JSON.stringify(vector),
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
    });
    if (error || !Array.isArray(data)) throw new Error("library search failed");
    return (data as Record<string, unknown>[]).map((row): Passage => ({
      title: String(row.page_title),
      url: String(row.page_url),
      content: String(row.content),
      similarity: Number(row.similarity),
    }));
  };
}
