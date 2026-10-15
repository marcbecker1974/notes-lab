// Copy button of a code block (Feature 8.1). Pure apart from the clipboard it is given, so
// `npm run test:editor` can test it with a fake. It never touches the note or its draft.

export type ClipboardLike = { writeText(text: string): Promise<void> };

/** Copies `text` exactly as given. Resolves to false when there is no clipboard or it refuses. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
