/** One passage the library search found: a chunk with its source article. */
export type Passage = { title: string; url: string; content: string; similarity: number };

/** Runs one search for the signed-in user; throws if the search could not be done. */
export type SearchLibrary = (query: string) => Promise<Passage[]>;

/** What the chat shows for each search the model made. */
export type SearchNote = { query: string; count: number; failed?: boolean };

/** At most this many searches per question: the first one plus two retries. */
export const MAX_SEARCHES = 3;
export const MAX_QUERY_LENGTH = 300;

export const NOT_COVERED = "Not covered by your library.";

/** The one tool the model can call (OpenAI-style tool calling, no framework). */
export const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_library",
    description:
      "Search the user's private library of saved Wikipedia articles and return the best matching passages with their source article. Returns nothing for topics the library does not cover.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A short, keyword-rich search phrase for the fact being asked about.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

/** The query from the model's tool call, or null if the arguments are unusable. */
export function parseSearchQuery(args: unknown): string | null {
  if (typeof args !== "string") return null;
  try {
    const query = (JSON.parse(args) as { query?: unknown } | null)?.query;
    if (typeof query !== "string") return null;
    const clean = query.replace(/\s+/g, " ").trim();
    return clean && clean.length <= MAX_QUERY_LENGTH ? clean : null;
  } catch {
    return null;
  }
}

/** Passage text is the library's data: it must not be able to close the wrapper tag. */
const defang = (text: string) => text.replace(/<\s*\/?\s*passages\b/gi, "‹passages");

/** The tool result text the model reads. Titles, links and scores sit next to the text. */
export function formatSearchResult(query: string, passages: Passage[], searchesLeft: number): string {
  const left = searchesLeft > 0
    ? `You may search ${searchesLeft} more time${searchesLeft === 1 ? "" : "s"} for this question.`
    : "No searches are left for this question: answer now or say it is not covered.";
  if (passages.length === 0) {
    return `No passages matched "${defang(query)}". Nothing in the library covers it under these words. ${left}`;
  }
  const body = passages
    .map((p, i) => `[${i + 1}] ${defang(p.title)} - ${p.url} (similarity ${p.similarity.toFixed(2)})\n${defang(p.content)}`)
    .join("\n\n");
  return `Results for "${defang(query)}": ${passages.length} passage${passages.length === 1 ? "" : "s"}, higher similarity means a closer match. ${left}\n<passages>\n${body}\n</passages>`;
}

/**
 * Keeps links only if they point to an article the search actually returned. A markdown link
 * with any other address is reduced to its text, so a made-up or injected link never reaches
 * the chat as a clickable citation.
 */
export function keepKnownCitations(text: string, allowedUrls: Set<string>): string {
  return text.replace(/\[([^\]]*)\]\((\S+?)\)/g, (whole, label: string, url: string) =>
    allowedUrls.has(url) ? whole : label);
}
