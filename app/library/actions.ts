"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { addArticle } from "@/lib/library/ingest";
import { deletePage } from "@/lib/library/library-store";
import { parseEntries } from "@/lib/library/parse-input";
import { refreshArticle } from "@/lib/library/refresh";
import type { ArticleResult } from "@/lib/library/types";
import { createClient } from "@/lib/supabase/server";

export type AddState = { results: ArticleResult[]; message?: string } | null;

const MAX_INPUT_CHARS = 5_000;

/**
 * Adds the articles in the form to the signed-in user's library. The session is verified
 * here, not only on the page (a Server Action is a public endpoint). Articles are fetched
 * and embedded one at a time; nothing leaves the server but the result messages.
 */
export async function addToLibrary(_previous: AddState, formData: FormData): Promise<AddState> {
  await requireUser(); // redirect throws: deliberately outside try/catch

  const text = formData.get("articles");
  if (typeof text !== "string" || !text.trim()) {
    return { results: [], message: "Paste at least one Wikipedia link or article title." };
  }
  if (text.length > MAX_INPUT_CHARS) {
    return { results: [], message: "That is too much text. Paste fewer links or titles." };
  }

  const { entries, skipped } = parseEntries(text);
  const supabase = await createClient();
  const results: ArticleResult[] = [];
  for (const entry of entries) results.push(await addArticle(supabase, entry));

  revalidatePath("/library");
  return {
    results,
    message: skipped > 0 ? `Only the first ${entries.length} lines were used; add the other ${skipped} separately.` : undefined,
  };
}

export type PageActionResult = { ok: boolean; message: string };

/** Fetches the latest article text and replaces the page's chunks and embeddings. */
export async function refreshPage(pageId: number): Promise<PageActionResult> {
  await requireUser();
  if (!Number.isSafeInteger(pageId) || pageId <= 0) return { ok: false, message: "This article could not be found." };

  const result = await refreshArticle(await createClient(), pageId);
  revalidatePath("/library");
  return { ok: result.status === "saved" || result.status === "updated", message: result.message };
}

/** Removes a page; the database deletes its chunks with it. */
export async function removePage(pageId: number): Promise<PageActionResult> {
  await requireUser();
  if (!Number.isSafeInteger(pageId) || pageId <= 0) return { ok: false, message: "This article could not be found." };

  try {
    const removed = await deletePage(await createClient(), pageId);
    revalidatePath("/library");
    return removed
      ? { ok: true, message: "Removed." }
      : { ok: false, message: "This article is no longer in your library." };
  } catch {
    return { ok: false, message: "The article could not be removed. Please try again." };
  }
}
