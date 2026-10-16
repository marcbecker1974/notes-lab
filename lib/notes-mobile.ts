// Which pane a phone shows (below 768px the list and the editor are two screens, not
// two columns). Pure and import-free so `npm run test:mobile` (plain Node) can test it.
// The wide layouts ignore this: there the list and the editor are always both visible.

export type MobilePane = "list" | "editor";

/** The editor is only shown for a note that exists; otherwise the list (never an empty editor screen). */
export function visiblePane(requested: MobilePane, hasSelectedNote: boolean): MobilePane {
  return requested === "editor" && hasSelectedNote ? "editor" : "list";
}

/** Back from the editor: with unsaved changes the user is asked first, nothing is dropped silently. */
export function backAction(dirty: boolean): "ask" | "go" {
  return dirty ? "ask" : "go";
}
