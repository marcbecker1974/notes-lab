// Markdown export of a single note (Feature 9). Pure and import-free so `npm run
// test:auth` (plain Node) can test it. It works on the saved note only: the title
// becomes an H1 and the body follows unchanged. No collection, tags or other
// metadata are exported.
//
// Since Feature 8 the body is Markdown written by the rich-text editor (or plain
// text from before), so exporting it unchanged is correct. The only inline HTML the
// editor writes is `<u>text</u>` for underline: standard Markdown has no underline
// syntax, and CommonMark allows inline HTML, so most viewers show it underlined and
// the others show the plain text.
//
// YAML front matter only works at the very start of a file, so when the saved body
// starts with it, the export writes the block first, then the `# Title`, then the rest.

type ExportableNote = { title: string; body: string };

const FILENAME_MAX_BYTES = 200; // UTF-8 bytes before the extension (file systems allow 255)
const FALLBACK_NAME = "note";
// Characters not allowed in file names on common systems, control characters, and
// invisible or direction-changing characters that can disguise a name.
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;
// Windows reserves these names with any extension too (CON.txt.md is still CON).
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)$/i;

// YAML front matter: a first line `---`, then only `key: value`, list, indented or
// comment lines, closed by `---` or `...`. A rule, some prose and another rule is not
// front matter (a prose line is not a YAML line). Also used by the editor's guard.
// It is found by a line scanner, one pass, each line tested by an anchored pattern: a
// single regex over the whole block backtracked exponentially when the closing line
// was missing (independent review of PR #10).
const OPENER = /^---[ \t]*$/;
const CLOSER = /^[ \t]*(?:---|\.\.\.)[ \t]*$/;
const YAML_LINE = /^(?:[ \t]*$|[ \t]*#|[ \t]+\S|[ \t]*-(?:[ \t]|$)|[^\s:#][^:\n]*:(?:[ \t]|$))/;
const KEY_LINE = /^[^\s#-][^:\n]*:/;

/** The front matter block (as written, no BOM) and the text after it, or null when the body has none. */
export function splitFrontMatter(body: string): { front: string; rest: string } | null {
  const start = body.charCodeAt(0) === 0xfeff ? 1 : 0;
  let pos = start;
  let hasKey = false;
  let first = true;
  while (pos < body.length) {
    const newline = body.indexOf("\n", pos);
    const end = newline === -1 ? body.length : newline;
    const line = body.slice(pos, end).replace(/\r$/, "");
    const next = newline === -1 ? body.length : newline + 1;
    if (first) {
      if (newline === -1 || !OPENER.test(line)) return null;
      first = false;
    } else if (CLOSER.test(line)) {
      return hasKey ? { front: body.slice(start, next), rest: body.slice(next) } : null;
    } else if (line.trim() !== "") {
      if (!YAML_LINE.test(line)) return null;
      if (KEY_LINE.test(line)) hasKey = true;
    }
    pos = next;
  }
  return null;
}

const lineBreaks = (text: string) => text.replace(/\r\n?/g, "\n");

/**
 * `# Title`, a blank line and the body; just the heading when the body is empty. A body
 * that starts with YAML front matter is written as front matter, `# Title`, the rest.
 */
export function noteToMarkdown(note: ExportableNote): string {
  const title = note.title.replace(/\s+/g, " ").trim();
  const body = lineBreaks(note.body).replace(/\n+$/, "");
  const split = splitFrontMatter(body);
  if (split) {
    const front = split.front.replace(/\n+$/, "");
    const rest = split.rest.replace(/^\n+/, "");
    return rest.trim() === "" ? `${front}\n\n# ${title}\n` : `${front}\n\n# ${title}\n\n${rest}\n`;
  }
  return body.trim() === "" ? `# ${title}\n` : `# ${title}\n\n${body}\n`;
}

/** A safe, readable file name for the note, always ending in `.md`. */
export function markdownFilename(title: string): string {
  let name = title
    .normalize("NFC")
    .replace(UNSAFE, "-")
    .replace(/\s+/g, " ")
    .trim();
  // Shorten by whole characters until the UTF-8 size fits (an emoji takes 4 bytes).
  const encoder = new TextEncoder();
  let bytes = 0;
  let shortened = "";
  for (const char of name) {
    bytes += encoder.encode(char).length;
    if (bytes > FILENAME_MAX_BYTES) break;
    shortened += char;
  }
  name = shortened;
  // No leading or trailing dots, spaces or hyphens (hidden files, Windows trimming).
  name = name.replace(/^[.\s-]+|[.\s-]+$/g, "");
  if (name === "") name = FALLBACK_NAME;
  if (WINDOWS_RESERVED.test(name.split(".")[0].trim())) name = `_${name}`;
  return `${name}.md`;
}
