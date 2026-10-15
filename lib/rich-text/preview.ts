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

/** A short plain-text preview for the note list (only the start of the body is processed). */
export function plainTextPreview(body: string): string {
  return unescapeMarkdown(body.slice(0, 600))
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
