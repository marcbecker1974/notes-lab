// The only module that talks to Supabase for notes, collections and tags.
// See docs/ARCHITECTURE.md section 4 and CLAUDE.md "Database access rules".
//
// - Browser-side: it uses the browser client, so call it from client components.
// - Never reads or writes `user_id`; no role or auth logic (the database default
//   and, later, RLS handle ownership).
// - Filtering, search, AND tag filtering and counts happen in memory in the UI.
// - Every function returns typed data or throws NotesDbError with a user-safe
//   message. Raw Postgres/PostgREST errors are kept only in `cause`.

import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Limits (mirror the CHECK constraints in the schema migration)
// ---------------------------------------------------------------------------

export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 20000;
export const NAME_MAX = 50; // collection and tag names

// ---------------------------------------------------------------------------
// Public types (camelCase, no user_id)
// ---------------------------------------------------------------------------

export type Note = {
  id: number;
  title: string;
  body: string;
  collectionId: number | null;
  createdAt: string;
  updatedAt: string;
  tagIds: number[];
};

export type Collection = {
  id: number;
  name: string;
  createdAt: string;
};

export type Tag = {
  id: number;
  name: string;
  color: string | null;
};

export type NewNote = {
  title: string;
  body?: string;
  collectionId?: number | null;
};

export type NotePatch = {
  title?: string;
  body?: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type NotesDbErrorKind =
  | "validation" // rejected before sending (empty or too long)
  | "duplicate" // unique violation (23505)
  | "not_found" // row or referenced row is gone (PGRST116, 23503)
  | "invalid" // check constraint violation (23514)
  | "forbidden" // insufficient privilege (42501)
  | "unknown";

export class NotesDbError extends Error {
  readonly kind: NotesDbErrorKind;
  readonly operation: string;

  constructor(
    kind: NotesDbErrorKind,
    operation: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "NotesDbError";
    this.kind = kind;
    this.operation = operation;
  }
}

type DbError = { code?: string; message?: string } | null;

function toNotesDbError(operation: string, error: DbError | unknown): NotesDbError {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "23505":
      return new NotesDbError("duplicate", operation, "That name already exists.", error);
    case "23503":
    case "PGRST116":
      return new NotesDbError(
        "not_found",
        operation,
        "That item no longer exists. Refresh and try again.",
        error,
      );
    case "23514":
      return new NotesDbError(
        "invalid",
        operation,
        "The text is empty or too long.",
        error,
      );
    case "42501":
      return new NotesDbError("forbidden", operation, "This action is not allowed.", error);
    default:
      return new NotesDbError(
        "unknown",
        operation,
        "Something went wrong. Please try again.",
        error,
      );
  }
}

// Runs one request and converts any failure (returned or thrown, for example a
// network error) into a NotesDbError.
async function run<T>(
  operation: string,
  request: () => PromiseLike<{ data: T | null; error: DbError }>,
): Promise<T> {
  let result: { data: T | null; error: DbError };
  try {
    result = await request();
  } catch (error) {
    throw toNotesDbError(operation, error);
  }
  if (result.error) throw toNotesDbError(operation, result.error);
  return result.data as T;
}

// ---------------------------------------------------------------------------
// Client seam: the single place that decides which Supabase client is used
// ---------------------------------------------------------------------------

function getClient() {
  return createClient();
}

// ---------------------------------------------------------------------------
// Row shapes and mapping (internal)
// ---------------------------------------------------------------------------

type NoteRow = {
  id: number;
  title: string;
  body: string | null;
  collection_id: number | null;
  created_at: string;
  updated_at: string;
  note_tags?: { tag_id: number }[] | null;
};

type CollectionRow = { id: number; name: string; created_at: string };
type TagRow = { id: number; name: string; color: string | null };

// Explicit column lists, never select('*'). note_tags(tag_id) embeds the tag
// ids in the same request, via the foreign keys.
const NOTE_COLUMNS =
  "id, title, body, collection_id, created_at, updated_at, note_tags(tag_id)";
const COLLECTION_COLUMNS = "id, name, created_at";
const TAG_COLUMNS = "id, name, color";

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    collectionId: row.collection_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tagIds: (row.note_tags ?? []).map((link) => link.tag_id),
  };
}

function toCollection(row: CollectionRow): Collection {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color };
}

// ---------------------------------------------------------------------------
// Input validation (friendly errors before a request; the database still
// enforces the same limits)
// ---------------------------------------------------------------------------

function cleanTitle(operation: string, title: string): string {
  const value = title.trim();
  if (value.length === 0) {
    throw new NotesDbError("validation", operation, "Please enter a title.");
  }
  if (value.length > NOTE_TITLE_MAX) {
    throw new NotesDbError(
      "validation",
      operation,
      `The title can have at most ${NOTE_TITLE_MAX} characters.`,
    );
  }
  return value;
}

function checkBody(operation: string, body: string): string {
  if (body.length > NOTE_BODY_MAX) {
    throw new NotesDbError(
      "validation",
      operation,
      `The note can have at most ${NOTE_BODY_MAX} characters.`,
    );
  }
  return body;
}

function cleanName(operation: string, name: string, what: string): string {
  const value = name.trim();
  if (value.length === 0) {
    throw new NotesDbError("validation", operation, `Please enter a ${what} name.`);
  }
  if (value.length > NAME_MAX) {
    throw new NotesDbError(
      "validation",
      operation,
      `The ${what} name can have at most ${NAME_MAX} characters.`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/** All notes with their tag ids, newest change first (one request). */
export async function listNotes(): Promise<Note[]> {
  const rows = await run<NoteRow[]>("listNotes", () =>
    getClient()
      .from("notes")
      .select(NOTE_COLUMNS)
      .order("updated_at", { ascending: false }),
  );
  return rows.map(toNote);
}

export async function createNote(input: NewNote): Promise<Note> {
  const row = {
    title: cleanTitle("createNote", input.title),
    body: checkBody("createNote", input.body ?? ""),
    collection_id: input.collectionId ?? null,
  };
  const created = await run<NoteRow>("createNote", () =>
    getClient().from("notes").insert(row).select(NOTE_COLUMNS).single(),
  );
  return toNote(created);
}

/** Changes the title and/or body. `updated_at` is set by a database trigger. */
export async function updateNote(id: number, patch: NotePatch): Promise<Note> {
  const changes: { title?: string; body?: string } = {};
  if (patch.title !== undefined) changes.title = cleanTitle("updateNote", patch.title);
  if (patch.body !== undefined) changes.body = checkBody("updateNote", patch.body);
  if (Object.keys(changes).length === 0) {
    throw new NotesDbError("validation", "updateNote", "There is nothing to save.");
  }
  const updated = await run<NoteRow>("updateNote", () =>
    getClient().from("notes").update(changes).eq("id", id).select(NOTE_COLUMNS).single(),
  );
  return toNote(updated);
}

/** Moves a note into a collection, or to "Uncollected" with null. */
export async function setNoteCollection(
  id: number,
  collectionId: number | null,
): Promise<Note> {
  const updated = await run<NoteRow>("setNoteCollection", () =>
    getClient()
      .from("notes")
      .update({ collection_id: collectionId })
      .eq("id", id)
      .select(NOTE_COLUMNS)
      .single(),
  );
  return toNote(updated);
}

/** Deletes a note; its tag links go with it (ON DELETE CASCADE). */
export async function deleteNote(id: number): Promise<void> {
  const rows = await run<{ id: number }[]>("deleteNote", () =>
    getClient().from("notes").delete().eq("id", id).select("id"),
  );
  if (rows.length === 0) throw toNotesDbError("deleteNote", { code: "PGRST116" });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function listCollections(): Promise<Collection[]> {
  const rows = await run<CollectionRow[]>("listCollections", () =>
    getClient().from("collections").select(COLLECTION_COLUMNS).order("name"),
  );
  return rows.map(toCollection);
}

export async function createCollection(name: string): Promise<Collection> {
  const value = cleanName("createCollection", name, "collection");
  const created = await run<CollectionRow>("createCollection", () =>
    getClient().from("collections").insert({ name: value }).select(COLLECTION_COLUMNS).single(),
  );
  return toCollection(created);
}

/** Deletes a collection; its notes become uncollected (ON DELETE SET NULL). */
export async function deleteCollection(id: number): Promise<void> {
  const rows = await run<{ id: number }[]>("deleteCollection", () =>
    getClient().from("collections").delete().eq("id", id).select("id"),
  );
  if (rows.length === 0) throw toNotesDbError("deleteCollection", { code: "PGRST116" });
}

// ---------------------------------------------------------------------------
// Tags and note-tag links
// ---------------------------------------------------------------------------

export async function listTags(): Promise<Tag[]> {
  const rows = await run<TagRow[]>("listTags", () =>
    getClient().from("tags").select(TAG_COLUMNS).order("name"),
  );
  return rows.map(toTag);
}

// Case-insensitive exact match: escape the LIKE wildcards in the name.
async function findTagByName(operation: string, name: string): Promise<Tag | null> {
  const pattern = name.replace(/[\\%_]/g, "\\$&");
  const rows = await run<TagRow[]>(operation, () =>
    getClient().from("tags").select(TAG_COLUMNS).ilike("name", pattern).limit(1),
  );
  return rows.length > 0 ? toTag(rows[0]) : null;
}

/**
 * Adds a tag to a note, creating the tag if no tag with that name exists
 * (compared case-insensitively). Adding a tag that is already on the note is
 * not an error. Returns the tag.
 */
export async function addTagToNote(noteId: number, tagName: string): Promise<Tag> {
  const operation = "addTagToNote";
  const name = cleanName(operation, tagName, "tag");

  let tag = await findTagByName(operation, name);
  if (!tag) {
    try {
      const created = await run<TagRow>(operation, () =>
        getClient().from("tags").insert({ name }).select(TAG_COLUMNS).single(),
      );
      tag = toTag(created);
    } catch (error) {
      // Another request created the same name in the meantime: use that tag.
      if (error instanceof NotesDbError && error.kind === "duplicate") {
        tag = await findTagByName(operation, name);
      }
      if (!tag) throw error;
    }
  }

  const tagId = tag.id;
  await run<null>(operation, () =>
    getClient()
      .from("note_tags")
      .upsert({ note_id: noteId, tag_id: tagId }, { onConflict: "note_id,tag_id", ignoreDuplicates: true }),
  );
  return tag;
}

/** Removes the link between a note and a tag. The tag itself is kept. */
export async function removeTagFromNote(noteId: number, tagId: number): Promise<void> {
  await run<null>("removeTagFromNote", () =>
    getClient().from("note_tags").delete().eq("note_id", noteId).eq("tag_id", tagId),
  );
}
