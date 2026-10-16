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

/** How many notes carry each tag (totals, independent of filters). */
export function countTagUses(notes: Note[]): Map<number, number> {
  const uses = new Map<number, number>();
  for (const note of notes) {
    for (const id of note.tagIds) uses.set(id, (uses.get(id) ?? 0) + 1);
  }
  return uses;
}

/** A note matches when it carries every selected tag (R10). */
export function withAllTags(notes: Note[], tagIds: number[]): Note[] {
  if (tagIds.length === 0) return notes;
  return notes.filter((note) => tagIds.every((id) => note.tagIds.includes(id)));
}

// The editor stores the body as Markdown and escapes characters (`snake\_case`,
// `5 &lt; 6`); search also looks at the body as the user sees it. Inline so this
// module stays free of runtime imports.
const unescaped = (body: string) =>
  body
    .replace(/\\([\\`*_{}[\]()#+\-.!~<>|&$:"'/^=%@;,?])/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Case-insensitive match on title or body (R11). */
export function matchesQuery(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle) ||
    unescaped(note.body).toLowerCase().includes(needle)
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

// --- Ordering of the note list (Feature 8.2). Display only; nothing is stored in the database.

export const NOTE_SORTS = ["title-asc", "title-desc", "modified-desc", "modified-asc"] as const;
export type NoteSort = (typeof NOTE_SORTS)[number];
export const DEFAULT_NOTE_SORT: NoteSort = "title-asc";
export const NOTE_SORT_LABELS: Record<NoteSort, string> = {
  "title-asc": "Title A\u2013Z / 0\u20139",
  "title-desc": "Title Z\u2013A / 9\u20130",
  "modified-desc": "Last modified: newest first",
  "modified-asc": "Last modified: oldest first",
};
export const NOTE_SORT_STORAGE_KEY = "notes-lab:note-sort";

// Natural order: digit runs compare as numbers (Chapter 2 before Chapter 10; 00 to 08 in order).
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** A copy of `notes` in the chosen order; ties fall back to the id so the order is stable. */
export function orderNotes(notes: Note[], sort: NoteSort): Note[] {
  const byTitle = (a: Note, b: Note) => collator.compare(a.title, b.title) || a.id - b.id;
  const byDate = (a: Note, b: Note) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
  return [...notes].sort((a, b) => {
    switch (sort) {
      case "title-asc":
        return byTitle(a, b);
      case "title-desc":
        return -collator.compare(a.title, b.title) || a.id - b.id;
      case "modified-desc":
        return byDate(b, a) || b.id - a.id;
      case "modified-asc":
        return byDate(a, b) || a.id - b.id;
    }
  });
}

export const isNoteSort = (value: unknown): value is NoteSort =>
  typeof value === "string" && (NOTE_SORTS as readonly string[]).includes(value);

type SortStorage = Pick<Storage, "getItem" | "setItem">;

/** The saved choice, or the default when nothing valid is saved or storage is unavailable. */
export function loadNoteSort(storage: SortStorage | null | undefined): NoteSort {
  try {
    const raw = storage?.getItem(NOTE_SORT_STORAGE_KEY);
    return isNoteSort(raw) ? raw : DEFAULT_NOTE_SORT;
  } catch {
    return DEFAULT_NOTE_SORT;
  }
}

export function saveNoteSort(storage: SortStorage | null | undefined, sort: NoteSort): void {
  try {
    storage?.setItem(NOTE_SORT_STORAGE_KEY, sort);
  } catch {
    // private mode or blocked storage: the choice just lasts for this visit
  }
}
