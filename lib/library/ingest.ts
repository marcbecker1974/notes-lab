import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ChatServiceError, getEmbeddings } from "../ai/openrouter.ts";
import { chunkText } from "./chunk.ts";
import { LibraryStoreError, savePage } from "./library-store.ts";
import type { ParsedEntry, RejectedEntry } from "./parse-input.ts";
import type { ArticleResult } from "./types.ts";
import { fetchArticle } from "./wikipedia.ts";

const EMBED_BATCH = 32;

/**
 * One input line, end to end on the server: fetch the extract, split it, embed the chunks
 * (batches, one after another) and save page and chunks. Nothing is saved unless every
 * chunk has its embedding. Never throws; every failure becomes a message for the user.
 */
export async function addArticle(
  supabase: SupabaseClient,
  entry: ParsedEntry | RejectedEntry,
): Promise<ArticleResult> {
  if ("error" in entry) return { input: entry.input, status: "invalid", message: entry.error };
  const { input } = entry;

  const article = await fetchArticle(entry);
  if (article.status === "missing") {
    return { input, status: "missing", message: `No Wikipedia article found for “${entry.title}”. Check the spelling or paste the link.` };
  }
  if (article.status === "error") return { input, status: "error", message: article.message };

  try {
    const chunks = chunkText(article.text);
    const embeddings: number[][] = [];
    for (let from = 0; from < chunks.length; from += EMBED_BATCH) {
      embeddings.push(...(await getEmbeddings(chunks.slice(from, from + EMBED_BATCH))));
    }
    const { replaced } = await savePage(supabase, { title: article.title, url: article.url }, chunks, embeddings);
    const note = article.truncated ? " Only the first part of this long article was saved." : "";
    return {
      input,
      status: replaced ? "updated" : "saved",
      title: article.title,
      url: article.url,
      message: `${replaced ? "Updated" : "Saved"} ${chunks.length} ${chunks.length === 1 ? "chunk" : "chunks"}.${note}`,
    };
  } catch (error) {
    const known = error instanceof ChatServiceError || error instanceof LibraryStoreError;
    return {
      input,
      status: "error",
      message: known ? error.message : "The article could not be saved. Please try again.",
    };
  }
}
