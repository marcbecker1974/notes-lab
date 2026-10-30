import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addArticle } from "./ingest.ts";
import { deletePage, getPage, LibraryStoreError } from "./library-store.ts";
import { parseEntries } from "./parse-input.ts";
import type { ArticleResult } from "./types.ts";

/**
 * Fetches the latest text of a saved page and replaces its chunks and embeddings (the
 * save step replaces the chunks of an existing link, so there is never a duplicate). If
 * Wikipedia now reports a different link (the article was moved), the new link is saved
 * and the old page is removed, so the library still holds the article once.
 */
export async function refreshArticle(supabase: SupabaseClient, pageId: number): Promise<ArticleResult> {
  let page: Awaited<ReturnType<typeof getPage>>;
  try {
    page = await getPage(supabase, pageId);
  } catch (error) {
    const message = error instanceof LibraryStoreError ? error.message : "The article could not be loaded. Please try again.";
    return { input: String(pageId), status: "error", message };
  }
  if (!page) return { input: String(pageId), status: "missing", message: "This article is no longer in your library." };

  const [entry] = parseEntries(page.url).entries;
  const result = await addArticle(supabase, entry);
  if ((result.status === "saved" || result.status === "updated") && result.url !== page.url) {
    try {
      await deletePage(supabase, page.id);
    } catch {
      return { ...result, message: `${result.message} The old entry could not be removed; remove it by hand.` };
    }
  }
  return result.status === "updated" ? { ...result, message: result.message.replace(/^Updated/, "Refreshed") } : result;
}
