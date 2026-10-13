// Pure, in-memory view logic for the notes UI: collection view, AND tag filter,
// live search and ordering. No Supabase access here (see lib/notes-db.ts).

import type { Note } from "@/lib/notes-db";

export type View =
  | { kind: "all" }
  | { kind: "uncollected" }
  | { kind: "collection"; id: number };

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "collection" && b.kind === "collection" ? a.id === b.id : true;
}

/** Newest change first, then highest id (the order `listNotes` returns). */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id,
  );
}

export function notesInView(notes: Note[], view: View): Note[] {
  switch (view.kind) {
    case "all":
      return notes;
    case "uncollected":
      return notes.filter((note) => note.collectionId === null);
    case "collection":
      return notes.filter((note) => note.collectionId === view.id);
  }
}

export type NoteCounts = {
  all: number;
  uncollected: number;
  byCollection: Map<number, number>;
};

/** Total notes per view in one pass; ignores tag and search filters. */
export function countNotes(notes: Note[]): NoteCounts {
  const byCollection = new Map<number, number>();
  let uncollected = 0;
  for (const note of notes) {
    if (note.collectionId === null) uncollected++;
    else byCollection.set(note.collectionId, (byCollection.get(note.collectionId) ?? 0) + 1);
  }
  return { all: notes.length, uncollected, byCollection };
}

/** A note matches when it carries every selected tag (R10). */
export function withAllTags(notes: Note[], tagIds: number[]): Note[] {
  if (tagIds.length === 0) return notes;
  return notes.filter((note) => tagIds.every((id) => note.tagIds.includes(id)));
}

/** Case-insensitive match on title or body (R11). */
export function matchesQuery(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle)
  );
}

export function withQuery(notes: Note[], query: string): Note[] {
  return notes.filter((note) => matchesQuery(note, query));
}

export type EmptyReason =
  | "no-notes" // nothing in this view at all (empty collection, no uncollected, no notes)
  | "no-tag-match" // the selected tags have no common note
  | "no-search-match"; // the query matches nothing

export type FilteredNotes = {
  notes: Note[];
  /** Why the list is empty, or null when there are results. */
  empty: EmptyReason | null;
};

/** View, then AND tags, then search, remembering where the list ran dry. */
export function filterNotes(
  notes: Note[],
  view: View,
  tagIds: number[],
  query: string,
): FilteredNotes {
  const inView = notesInView(notes, view);
  if (inView.length === 0) return { notes: [], empty: "no-notes" };
  const tagged = withAllTags(inView, tagIds);
  if (tagged.length === 0) return { notes: [], empty: "no-tag-match" };
  const found = withQuery(tagged, query);
  if (found.length === 0) return { notes: [], empty: "no-search-match" };
  return { notes: found, empty: null };
}
