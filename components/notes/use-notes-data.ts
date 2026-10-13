"use client";

// The only UI file that calls lib/notes-db.ts. It loads everything once, keeps
// it in state and patches the state with the rows the database returns.

import { useCallback, useEffect, useState } from "react";

import {
  NotesDbError,
  addTagToNote,
  createCollection,
  createNote,
  deleteCollection,
  deleteNote,
  listCollections,
  listNotes,
  listTags,
  removeTagFromNote,
  setNoteCollection,
  updateNote,
  type Collection,
  type NewNote,
  type Note,
  type NotePatch,
  type Tag,
} from "@/lib/notes-db";
import { sortNotes } from "@/lib/notes-view";

export type LoadStatus = "loading" | "ready" | "error";

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

function replaceNote(notes: Note[], updated: Note): Note[] {
  return sortNotes(notes.map((note) => (note.id === updated.id ? updated : note)));
}

export function useNotesData() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [n, c, t] = await Promise.all([listNotes(), listCollections(), listTags()]);
    setNotes(n);
    setCollections(c);
    setTags(t);
  }, []);

  // Initial load (retried with `reload`).
  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      await fetchAll();
      setLoadError(null);
      setStatus("ready");
    } catch (error) {
      setLoadError(
        error instanceof NotesDbError ? error.message : "Could not load your notes.",
      );
      setStatus("error");
    }
  }, [fetchAll]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Silent re-sync after a "no longer exists" error or a bulk change. */
  const refresh = useCallback(async () => {
    try {
      await fetchAll();
    } catch {
      // keep the data we have; the caller already shows its own error
    }
  }, [fetchAll]);

  // Every action below throws NotesDbError on failure; the caller shows it.

  const addNote = useCallback(async (input: NewNote) => {
    const note = await createNote(input);
    setNotes((current) => sortNotes([note, ...current]));
    return note;
  }, []);

  const saveNote = useCallback(async (id: number, patch: NotePatch) => {
    const note = await updateNote(id, patch);
    setNotes((current) => replaceNote(current, note));
    return note;
  }, []);

  const moveNote = useCallback(async (id: number, collectionId: number | null) => {
    const note = await setNoteCollection(id, collectionId);
    setNotes((current) => replaceNote(current, note));
    return note;
  }, []);

  const removeNote = useCallback(async (id: number) => {
    await deleteNote(id);
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const addCollection = useCallback(async (name: string) => {
    const collection = await createCollection(name);
    setCollections((current) => [...current, collection].sort(byName));
    return collection;
  }, []);

  const removeCollection = useCallback(
    async (id: number) => {
      await deleteCollection(id);
      setCollections((current) => current.filter((c) => c.id !== id));
      // The database moved its notes to "Uncollected" and bumped their updated_at.
      await refresh();
    },
    [refresh],
  );

  const addTag = useCallback(async (noteId: number, name: string) => {
    const tag = await addTagToNote(noteId, name);
    setTags((current) =>
      current.some((t) => t.id === tag.id) ? current : [...current, tag].sort(byName),
    );
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId && !note.tagIds.includes(tag.id)
          ? { ...note, tagIds: [...note.tagIds, tag.id] }
          : note,
      ),
    );
    return tag;
  }, []);

  const removeTag = useCallback(async (noteId: number, tagId: number) => {
    await removeTagFromNote(noteId, tagId);
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? { ...note, tagIds: note.tagIds.filter((id) => id !== tagId) }
          : note,
      ),
    );
  }, []);

  return {
    notes,
    collections,
    tags,
    status,
    loadError,
    reload,
    refresh,
    addNote,
    saveNote,
    moveNote,
    removeNote,
    addCollection,
    removeCollection,
    addTag,
    removeTag,
  };
}
