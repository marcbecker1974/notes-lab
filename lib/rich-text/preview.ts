// Plain text of a Markdown body for display and search. Display only: the stored
// Markdown and the export are unaffected. The editor escapes characters when it
// saves (`snake\_case`, `2 \* 3`, `5 &lt; 6`), so both functions undo that.

/** The body as a reader sees it: backslash escapes and the entities the editor writes undone. */
export function unescapeMarkdown(body: string): string {
  return body
    .replace(/\\([\\`*_{}[\]()#+\-.!~<>|&$:"'/^=%@;,?])/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const PREVIEW_CHARS = 600;
const MAX_TABLE_LINE = 1000; // a longer line is never a table row (also bounds the work per line)
const FENCE = /^\s{0,3}(```|~~~)/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
// A table separator row (`|---|:--:|` or `--|--`), tested on the trimmed line. One `\s*` between
// the parts keeps the matching linear. It must contain a pipe, so a bare `---` stays a rule.
const TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/;

function isTableSeparator(line: string): boolean {
  if (line.length > MAX_TABLE_LINE || !line.includes("|")) return false;
  return TABLE_SEPARATOR.test(line.trim());
}

/** A table row needs an unescaped pipe: the header line (before a separator row) and the body rows. */
const hasTablePipe = (line: string) => line.length <= MAX_TABLE_LINE && UNESCAPED_PIPE.test(line);

/** The cells of a table row (an escaped `\|` stays inside its cell). */
function tableCells(line: string): string[] {
  return line
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}

/** Markdown marks and escapes removed from `text`, whitespace collapsed. */
function cleanMarkdown(text: string): string {
  return unescapeMarkdown(text)
    .replace(/```[^\n]*\n?/g, "")
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/<\/?u>/g, "")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d{1,3}[.)]\s+(?=\S)|(-{3,}|\*{3,}|_{3,})\s*$)/gm, "")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/\*(?=\S)([^*\n]*\S)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A short plain-text preview for the note list. It prefers the prose of the note (headings,
 * paragraphs, lists, quotes). A table (a header line with a pipe, directly followed by a separator
 * row, and the rows after it) is never shown while there is prose; a note that is only tables shows
 * the text of its cells, and a note that is only code shows the code. A line that merely starts
 * with a pipe is prose, as before. Display only: the stored Markdown is never changed.
 */
export function plainTextPreview(body: string): string {
  const lines = body.split("\n");
  const prose: string[] = [];
  let proseLength = 0;
  let tables = "";
  let code = "";
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      if (code.length < PREVIEW_CHARS) code += `${line}\n`;
      continue;
    }
    if (hasTablePipe(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      let end = i + 2;
      while (end < lines.length && lines[end].trim() !== "" && hasTablePipe(lines[end]) && !FENCE.test(lines[end])) end++;
      if (tables.length < PREVIEW_CHARS) {
        for (const row of [lines[i], ...lines.slice(i + 2, end)]) tables += `${tableCells(row).join(" \u00b7 ")}\n`;
      }
      i = end - 1;
      continue;
    }
    prose.push(line);
    proseLength += line.length + 1;
    if (proseLength >= PREVIEW_CHARS) break; // enough prose: nothing else is needed
  }
  for (const source of [prose.join("\n"), tables, code]) {
    const text = cleanMarkdown(source.slice(0, PREVIEW_CHARS));
    if (text !== "") return text;
  }
  return "";
}
