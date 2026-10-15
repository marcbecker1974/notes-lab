import { markdownFilename, noteToMarkdown } from "@/lib/note-markdown";

/** Downloads the note as a `.md` file through the browser (no server, no new request). */
export function downloadNoteAsMarkdown(note: { title: string; body: string }): void {
  const blob = new Blob([noteToMarkdown(note)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = markdownFilename(note.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke later, not at once: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
