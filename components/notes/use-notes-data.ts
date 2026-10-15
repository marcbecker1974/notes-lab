"use client";

// The only UI file that calls lib/notes-db.ts. It loads everything once, keeps
// it in state and patches the state with the rows the database returns.

import { useCallback, useEffect, useState } from "react";

import {
  NotesDbError,
  addTagToNote,
  createCollection,
  createNote,
  createTag,
  deleteCollection,
  deleteNote,
  listCollections,
  listNotes,
  listTags,
  removeTagFromNote,
  setCollectionColor,
  setNoteCollection,
  setTagColor,
  updateNote,
  type Collection,
  type NewNote,
  type Note,
  type NotePatch,
  type Tag,
} from "@/lib/notes-db";
import { nextColor, type PaletteKey } from "@/lib/palette";
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
  // NotesDbError kind of the failed initial load (the UI uses it to detect a lost session).
  const [loadErrorKind, setLoadErrorKind] = useState<string | null>(null);

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
      setLoadErrorKind(null);
      setStatus("ready");
    } catch (error) {
      setLoadError(
        error instanceof NotesDbError ? error.message : "Could not load your notes.",
      );
      setLoadErrorKind(error instanceof NotesDbError ? error.kind : null);
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
    // New collections get the least-used colour so neighbours differ.
    const collection = await createCollection(name, nextColor(collections.map((c) => c.color)));
    setCollections((current) => [...current, collection].sort(byName));
    return collection;
  }, [collections]);

  const changeCollectionColor = useCallback(async (id: number, color: PaletteKey) => {
    const updated = await setCollectionColor(id, color);
    setCollections((current) => current.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const addNewTag = useCallback(async (name: string) => {
    const tag = await createTag(name, nextColor(tags.map((t) => t.color)));
    setTags((current) => [...current, tag].sort(byName));
    return tag;
  }, [tags]);

  const changeTagColor = useCallback(async (id: number, color: PaletteKey) => {
    const updated = await setTagColor(id, color);
    setTags((current) => current.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const removeCollection = useCallback(
    async (id: number) => {
      await deleteCollection(id);
      setCollections((current) => current.filter((c) => c.id !== id));
      // The database moved its notes to "Uncollected": mirror that locally so a failed
      // refetch cannot leave notes pointing at a collection that is gone ...
      setNotes((current) =>
        current.map((note) => (note.collectionId === id ? { ...note, collectionId: null } : note)),
      );
      // ... then re-sync to pick up their new updated_at values.
      await refresh();
    },
    [refresh],
  );

  const addTag = useCallback(async (noteId: number, name: string) => {
    const tag = await addTagToNote(noteId, name, nextColor(tags.map((t) => t.color)));
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
  }, [tags]);

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
    loadErrorKind,
    reload,
    refresh,
    addNote,
    saveNote,
    moveNote,
    removeNote,
    addCollection,
    removeCollection,
    changeCollectionColor,
    changeTagColor,
    addNewTag,
    addTag,
    removeTag,
  };
}
