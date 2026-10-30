import "server-only";

import type { ParsedEntry } from "./parse-input.ts";

/** Wikimedia's User-Agent policy: app name and version plus a contact address. */
export const WIKIPEDIA_USER_AGENT = "NotesLab/1.0 (marc.becker@berlin.de)";
/** Longer articles are cut here (about 125 chunks) to bound embedding cost. */
export const MAX_EXTRACT_CHARS = 50_000;

export type FetchedArticle =
  | { status: "ok"; title: string; url: string; text: string; truncated: boolean }
  | { status: "missing" }
  | { status: "error"; message: string };

/**
 * One plain-text extract through the official MediaWiki Action API, one title per
 * request, following redirects (`redirects=1`) so the stored title and link are the
 * real ones. The host is built from a lang code that parse-input.ts has validated.
 */
export async function fetchArticle(entry: Pick<ParsedEntry, "lang" | "title">): Promise<FetchedArticle> {
  const host = `${entry.lang}.wikipedia.org`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "extracts|info",
    explaintext: "1",
    exsectionformat: "plain",
    inprop: "url",
    titles: entry.title,
  });

  let response: Response;
  try {
    response = await fetch(`https://${host}/w/api.php?${params}`, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT, Accept: "application/json" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { status: "error", message: "Wikipedia could not be reached. Please try again." };
  }
  if (response.status === 429) return { status: "error", message: "Wikipedia asked us to slow down. Please wait a moment and try again." };
  if (!response.ok) return { status: "error", message: "Wikipedia could not answer this request. Please try again." };

  let data: { query?: { pages?: Record<string, unknown>[] }; error?: unknown };
  try {
    data = await response.json();
  } catch {
    return { status: "error", message: "Wikipedia sent an unreadable answer." };
  }
  const page = data.query?.pages?.[0] as
    | { title?: unknown; ns?: unknown; extract?: unknown; fullurl?: unknown; missing?: unknown; invalid?: unknown }
    | undefined;
  if (data.error || !page) return { status: "error", message: "Wikipedia sent an unexpected answer." };
  if (page.missing || page.invalid) return { status: "missing" };
  if (page.ns !== 0) return { status: "error", message: "Only articles can be added, not other Wikipedia pages." };

  const { title, extract, fullurl } = page;
  if (typeof title !== "string" || typeof extract !== "string" || typeof fullurl !== "string") {
    return { status: "error", message: "Wikipedia sent an unexpected answer." };
  }
  let link: URL;
  try {
    link = new URL(fullurl);
  } catch {
    return { status: "error", message: "Wikipedia sent an unexpected link." };
  }
  if (link.protocol !== "https:" || link.hostname !== host) {
    return { status: "error", message: "Wikipedia sent an unexpected link." };
  }
  const text = extract.trim();
  if (!text) return { status: "error", message: "This article has no text to save." };
  return {
    status: "ok",
    title,
    url: link.href,
    text: text.slice(0, MAX_EXTRACT_CHARS),
    truncated: text.length > MAX_EXTRACT_CHARS,
  };
}
