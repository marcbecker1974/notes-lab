export type ParsedEntry = { input: string; lang: string; title: string };
export type RejectedEntry = { input: string; error: string };

export const MAX_ENTRIES = 10;
const LANG = /^[a-z]{2,3}(?:-[a-z]{2,10})?$/;
const BAD_TITLE_CHARS = /[#<>[\]|{}]/;

function fromUrl(input: string): ParsedEntry | RejectedEntry {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { input, error: "This is not a valid link." };
  }
  const host = /^([a-z-]+?)(?:\.m)?\.wikipedia\.org$/.exec(url.hostname);
  if (url.protocol !== "https:" && url.protocol !== "http:") return { input, error: "Only Wikipedia links are supported." };
  if (!host || !LANG.test(host[1])) return { input, error: "Only Wikipedia links are supported." };
  let raw: string | null = null;
  if (url.pathname.startsWith("/wiki/")) raw = url.pathname.slice("/wiki/".length);
  else if (url.pathname === "/w/index.php") raw = url.searchParams.get("title");
  if (!raw) return { input, error: "This link does not point to an article." };
  try {
    return checkTitle(input, host[1], decodeURIComponent(raw).replace(/_/g, " "));
  } catch {
    return { input, error: "This link is not valid." };
  }
}

function checkTitle(input: string, lang: string, title: string): ParsedEntry | RejectedEntry {
  const clean = title.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) return { input, error: "Only Wikipedia links are supported." };
  if (!clean || clean.length > 255 || BAD_TITLE_CHARS.test(clean) || /[\u0000-\u001f]/.test(clean)) {
    return { input, error: "This is not a valid article title." };
  }
  return { input, lang, title: clean };
}

/**
 * One article per line: a Wikipedia link (any language) or a plain title (English).
 * Blank lines and repeats are dropped; at most MAX_ENTRIES are returned and `skipped`
 * counts the lines beyond that. The host in the result is always built from `lang`, which
 * is checked against a fixed pattern, so no user text ever chooses the server we call.
 */
export function parseEntries(text: string) {
  const seen = new Set<string>();
  const entries: (ParsedEntry | RejectedEntry)[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const input = line.trim();
    if (!input) continue;
    const parsed = /^https?:\/\//i.test(input) ? fromUrl(input) : checkTitle(input, "en", input.replace(/_/g, " "));
    const key = "title" in parsed ? `${parsed.lang}:${parsed.title.toLowerCase()}` : `bad:${input}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (entries.length >= MAX_ENTRIES) skipped++;
    else entries.push(parsed);
  }
  return { entries, skipped };
}
