// The three ways to look at a note body (Feature 8.1): Preview (read-only), Visual editor and
// Markdown source. Pure rules, so `npm run test:editor` can test them. Nothing here reads or
// returns note text: switching modes can never change the content.

import { checkVisualSafety, sourceModeNotice, visualRefusedNotice, type VisualCheck } from "./markdown.ts";

export type EditorMode = "preview" | "visual" | "source";

/**
 * Where a note opens. An ordinary note keeps the visual editor (unchanged). A note the visual
 * editor cannot keep intact (tables, images, task lists, HTML, front matter ...) opens in the
 * read-only Preview; it is edited through Markdown source.
 */
export function initialMode(check: VisualCheck): EditorMode {
  return check.safe ? "visual" : "preview";
}

export type ModeChange = {
  mode: EditorMode;
  /** Why the visual editor is not available for this note (null when it is). */
  blocked: string[] | null;
  /** Set only when the visual editor was just requested and refused: the reasons to explain to the user. */
  refused: string[] | null;
  /** The visual editor must be loaded from the current Markdown (never reported as an edit). */
  loadVisual: boolean;
};

/**
 * What happens when the user asks for `target`. The guard still decides about the visual
 * editor: for content it cannot keep intact the request is refused, the mode stays as it is
 * and the reasons are returned. Preview and source are always available.
 */
export function changeMode(target: EditorMode, current: EditorMode, currentBlocked: string[] | null, value: string): ModeChange {
  if (target !== "visual") return { mode: target, blocked: currentBlocked, refused: null, loadVisual: false };
  const check = checkVisualSafety(value);
  if (!check.safe) return { mode: current, blocked: check.reasons, refused: check.reasons, loadVisual: false };
  return { mode: "visual", blocked: null, refused: null, loadVisual: true };
}

/**
 * The visual editor is showing and the Markdown was reset from outside (Cancel puts the saved
 * text back). The guard is evaluated again for the restored text: content the visual editor
 * cannot keep intact is never loaded into it. The note falls back to the read-only Preview (the
 * restored text stays the draft, unchanged) with the reasons explained. This closes a data-loss
 * path that existed before Feature 8.1: Cancel loaded the saved Markdown into the visual editor
 * unchecked, so a note edited into a safe state in source mode and then cancelled could be loaded
 * with its table and lose it on the next keystroke.
 */
export function restoreVisual(value: string): ModeChange {
  const check = checkVisualSafety(value);
  if (!check.safe) return { mode: "preview", blocked: check.reasons, refused: check.reasons, loadVisual: false };
  return { mode: "visual", blocked: null, refused: null, loadVisual: true };
}

/**
 * The yellow notice above the note body. Source mode explains why the note is edited as Markdown
 * (as before). Preview is read-only and renders the Markdown correctly, so it shows nothing, except
 * an explanation right after the user asked for the visual editor and was refused. The visual
 * editor shows no notice.
 */
export function modeNotice(mode: EditorMode, blocked: string[] | null, refused: string[] | null): string | null {
  if (mode === "source") return blocked ? sourceModeNotice(blocked) : null;
  if (mode === "preview") return refused ? visualRefusedNotice(refused) : null;
  return null;
}
