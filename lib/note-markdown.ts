// Markdown export of a single note (Feature 9). Pure and import-free so `npm run
// test:auth` (plain Node) can test it. It works on the saved note only: the title
// becomes an H1 and the plain-text body follows unchanged (any Markdown the user
// typed keeps its meaning). No collection, tags or other metadata are exported.
//
// Revisit when Feature 8 (rich-text editor) changes the note content format: the
// body is exported as-is here, which is only correct while it is plain text.

type ExportableNote = { title: string; body: string };

const FILENAME_MAX = 80; // characters, before the extension
const FALLBACK_NAME = "note";
// Characters not allowed in file names on common systems, control characters, and
// invisible or direction-changing characters that can disguise a name.
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;
// Windows reserves these names with any extension too (CON.txt.md is still CON).
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const lineBreaks = (text: string) => text.replace(/\r\n?/g, "\n");

/** `# Title`, a blank line and the body; just the heading when the body is empty. */
export function noteToMarkdown(note: ExportableNote): string {
  const title = note.title.replace(/\s+/g, " ").trim();
  const body = lineBreaks(note.body).replace(/\n+$/, "");
  return body.trim() === "" ? `# ${title}\n` : `# ${title}\n\n${body}\n`;
}

/** A safe, readable file name for the note, always ending in `.md`. */
export function markdownFilename(title: string): string {
  let name = title
    .normalize("NFC")
    .replace(UNSAFE, "-")
    .replace(/\s+/g, " ")
    .trim();
  name = Array.from(name).slice(0, FILENAME_MAX).join("");
  // No leading or trailing dots, spaces or hyphens (hidden files, Windows trimming).
  name = name.replace(/^[.\s-]+|[.\s-]+$/g, "");
  if (name === "") name = FALLBACK_NAME;
  if (WINDOWS_RESERVED.test(name.split(".")[0].trim())) name = `_${name}`;
  return `${name}.md`;
}
