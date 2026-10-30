export type ContextNote = { title: string; body: string };

export const NOTES_CONTEXT_MAX = 20_000; // characters for the whole block
export const NOTE_EXCERPT_MAX = 2_000; // characters per note

/**
 * Plain-text block of the user's notes for the system prompt ("" when there are none).
 * Pure: the notes are loaded elsewhere. Notes come in newest first; once the budget is
 * used up the rest is left out and counted.
 */
export function buildNotesContext(
  notes: ContextNote[],
  maxChars: number = NOTES_CONTEXT_MAX,
  excerptMax: number = NOTE_EXCERPT_MAX,
): string {
  const parts: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const [index, note] of notes.entries()) {
    const body = note.body.trim();
    const text = body.length > excerptMax ? `${body.slice(0, excerptMax)}…` : body;
    // A note must not be able to close the block it sits in.
    const entry = `[Note ${index + 1}] Title: ${note.title.trim() || "(untitled)"}\n${text.replace(/<\/notes>/gi, "<\\/notes>")}`;
    if (used + entry.length > maxChars) {
      omitted = notes.length - index;
      break;
    }
    parts.push(entry);
    used += entry.length;
  }
  if (omitted > 0) parts.push(`(${omitted} older note${omitted === 1 ? "" : "s"} not shown)`);
  return parts.join("\n\n");
}
