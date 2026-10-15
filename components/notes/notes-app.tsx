"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createSessionLossGate } from "@/lib/auth/session-loss";
import { NotesDbError, type Collection, type Note } from "@/lib/notes-db";
import { filterNotes, type View } from "@/lib/notes-view";
import { NoteEditor, type Draft } from "./note-editor";
import { NotesList } from "./notes-list";
import { SidebarPanel } from "./sidebar-panel";
import { TopBar } from "./top-bar";
import { useNotesData } from "./use-notes-data";

type Pending =
  | { kind: "navigate"; proceed: () => Promise<void> | void }
  | { kind: "delete-note"; note: Note }
  | { kind: "delete-collection"; collection: Collection };

const errorMessage = (error: unknown) =>
  error instanceof NotesDbError ? error.message : "Something went wrong. Please try again.";

export function NotesApp() {
  const data = useNotesData();
  const router = useRouter();
  // When the database refuses a request because the session is gone, ask the server to
  // re-check: the server-side check on /notes then redirects to the sign-in page.
  const sessionLoss = useMemo(() => createSessionLossGate(() => router.refresh()), [router]);
  useEffect(() => {
    if (data.status === "error") sessionLoss.onError(data.loadErrorKind);
    else if (data.status === "ready") sessionLoss.reset();
  }, [data.status, data.loadErrorKind, sessionLoss]);
  const { notes, collections, tags } = data;

  const [viewState, setView] = useState<View>({ kind: "all" });
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // Only used at medium widths (768-1199px), where the sidebar is a toggled overlay.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // A collection that no longer exists (for example deleted in another tab) falls back to "All notes".
  const view = useMemo<View>(
    () =>
      viewState.kind === "collection" && !collections.some((c) => c.id === viewState.id)
        ? { kind: "all" }
        : viewState,
    [viewState, collections],
  );

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const activeDraft = selectedNote && draft ? draft : null;
  const dirty =
    selectedNote !== null &&
    activeDraft !== null &&
    (activeDraft.title !== selectedNote.title || activeDraft.body !== selectedNote.body);

  // Reload, tab close and Back would silently drop unsaved edits; ask the browser to confirm.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const { notes: visibleNotes, empty } = useMemo(
    () => filterNotes(notes, view, selectedTagIds, query),
    [notes, view, selectedTagIds, query],
  );

  // Runs a database action; on failure shows the message (and re-syncs if a row vanished).
  const attempt = useCallback(
    async (action: () => Promise<unknown>): Promise<string | null> => {
      try {
        await action();
        sessionLoss.reset();
        return null;
      } catch (e) {
        if (e instanceof NotesDbError) sessionLoss.onError(e.kind);
        if (e instanceof NotesDbError && e.kind === "not_found") {
          // A row vanished: re-sync, and say so in the page-level alert, because
          // an inline form message would disappear together with the removed note.
          void data.refresh();
          setError(errorMessage(e));
        }
        return errorMessage(e);
      }
    },
    [data, sessionLoss],
  );

  const act = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setError(null);
      const message = await attempt(action);
      setError(message);
      return message === null;
    },
    [attempt],
  );

  const open = (note: Note) => {
    setSelectedNoteId(note.id);
    setDraft({ title: note.title, body: note.body });
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!selectedNote || !draft) return false;
    setSaving(true);
    const sent = { title: draft.title, body: draft.body };
    const ok = await act(async () => {
      const saved = await data.saveNote(selectedNote.id, sent);
      // Adopt the saved text only if the draft is still what was sent: text typed (or a
      // different note opened) while the request ran must not be overwritten.
      setDraft((current) =>
        current && current.title === sent.title && current.body === sent.body
          ? { title: saved.title, body: saved.body }
          : current,
      );
    });
    setSaving(false);
    return ok;
  }, [act, data, draft, selectedNote]);

  // Leaving a note with unsaved changes asks first.
  const guarded = (proceed: () => Promise<void> | void) => {
    if (dirty) setPending({ kind: "navigate", proceed });
    else void proceed();
  };

  const selectNote = (id: number) => {
    if (id === selectedNoteId) {
      setSidebarOpen(false);
      return;
    }
    const target = notes.find((note) => note.id === id);
    if (target) {
      guarded(() => {
        setSidebarOpen(false); // not when the unsaved-changes dialog is cancelled
        open(target);
      });
    }
  };

  const selectView = (next: View) => {
    setView(next);
    setSidebarOpen(false);
  };

  const newNote = () =>
    guarded(async () => {
      setCreating(true);
      await act(async () => {
        const note = await data.addNote({
          title: "Untitled note",
          collectionId: view.kind === "collection" ? view.id : null,
        });
        open(note);
        // The new note has no tags and the default title: keep it visible in the list.
        setQuery("");
        setSelectedTagIds([]);
      });
      setCreating(false);
    });

  const createCollection = async (name: string) => {
    let created: Collection | null = null;
    const message = await attempt(async () => {
      created = await data.addCollection(name);
    });
    if (created) selectView({ kind: "collection", id: (created as Collection).id });
    return message;
  };

  const clearFilters = () => setSelectedTagIds([]);

  const confirmPending = async (choice: "save" | "discard" | "delete") => {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (current.kind === "navigate") {
      if (choice === "save" && !(await save())) return;
      await current.proceed();
    } else if (current.kind === "delete-note") {
      setDeleting(true);
      const ok = await act(() => data.removeNote(current.note.id));
      setDeleting(false);
      if (ok && selectedNoteId === current.note.id) {
        setSelectedNoteId(null);
        setDraft(null);
      }
    } else {
      setDeleting(true);
      const ok = await act(() => data.removeCollection(current.collection.id));
      setDeleting(false);
      if (ok) {
        setView((v) =>
          v.kind === "collection" && v.id === current.collection.id ? { kind: "all" } : v,
        );
      }
    }
  };

  if (data.status === "loading") {
    return (
      <div className="flex h-screen flex-col">
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[280px_420px_1fr]" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 border-r p-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="flex h-screen flex-col">
        <div className="mx-auto mt-16 max-w-md space-y-3 px-4">
          <Alert variant="destructive">
            <AlertDescription>{data.loadError}</AlertDescription>
          </Alert>
          <Button onClick={() => void data.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const viewTitle =
    view.kind === "all"
      ? "All notes"
      : view.kind === "uncollected"
        ? "Uncollected"
        : (collections.find((c) => c.id === view.id)?.name ?? "Collection");
  const viewColor =
    view.kind === "collection" ? (collections.find((c) => c.id === view.id)?.color ?? null) : null;
  const emptyViewMessage =
    view.kind === "collection"
      ? "No notes in this collection yet."
      : view.kind === "uncollected"
        ? "No uncollected notes."
        : "No notes yet. Create your first note.";

  return (
    <div className="flex h-screen flex-col bg-app">
      {error && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription className="flex items-center justify-between gap-2">
            {error}
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <main className="relative grid min-h-0 flex-1 gap-3 p-3 grid-rows-[auto_auto_auto_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)] md:grid-rows-1 min-[1200px]:grid-cols-[280px_minmax(0,1fr)]">
        <SidebarPanel
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          suspendEscape={pending !== null}
          notes={notes}
          collections={collections}
          tags={tags}
          view={view}
          selectedTagIds={selectedTagIds}
          onSelectView={selectView}
          onToggleTag={(id) =>
            setSelectedTagIds((cur) =>
              cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id],
            )
          }
          onClearTags={clearFilters}
          deleting={deleting}
          onCreateCollection={createCollection}
          onDeleteCollection={(collection) => setPending({ kind: "delete-collection", collection })}
          onChangeCollectionColor={(id, color) => void act(() => data.changeCollectionColor(id, color))}
          onChangeTagColor={(id, color) => void act(() => data.changeTagColor(id, color))}
          onNewNote={newNote}
          creatingNote={creating}
          onCreateTag={(name) => attempt(() => data.addNewTag(name))}
        />
        {/* Columns 2 and 3: a shared header, then the list and the editor. On mobile these
            wrappers vanish (display: contents) and everything stacks as before. */}
        <div className="flex min-h-0 flex-col gap-3 max-md:contents">
          <TopBar
            query={query}
            onQueryChange={setQuery}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            creating={creating}
            onNewNote={newNote}
          />
          <div className="grid min-h-0 flex-1 gap-3 max-md:contents md:grid-cols-[360px_minmax(0,1fr)] min-[1200px]:grid-cols-[420px_minmax(0,1fr)]">
            <NotesList
              title={viewTitle}
              titleColor={viewColor}
              notes={visibleNotes}
              empty={empty}
              emptyViewMessage={emptyViewMessage}
              tags={tags}
              selectedNoteId={selectedNoteId}
              query={query}
              filtersActive={selectedTagIds.length > 0}
              onSelectNote={selectNote}
              onClearFilters={clearFilters}
            />
            <NoteEditor
              note={selectedNote}
              draft={activeDraft}
              dirty={dirty}
              saving={saving}
              deleting={deleting}
              collections={collections}
              tags={tags}
              onDraftChange={setDraft}
              onSave={() => void save()}
              onCancel={() => selectedNote && setDraft({ title: selectedNote.title, body: selectedNote.body })}
              onMove={(collectionId) =>
                selectedNote && void act(() => data.moveNote(selectedNote.id, collectionId))
              }
              onAddTag={(name) => (selectedNote ? attempt(() => data.addTag(selectedNote.id, name)) : Promise.resolve(null))}
              onRemoveTag={(tagId) =>
                selectedNote && void act(() => data.removeTag(selectedNote.id, tagId))
              }
              onChangeTagColor={(id, color) => void act(() => data.changeTagColor(id, color))}
              onDelete={() => selectedNote && setPending({ kind: "delete-note", note: selectedNote })}
            />
          </div>
        </div>
      </main>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          {pending?.kind === "navigate" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                <AlertDialogDescription>
                  This note has changes that are not saved yet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="outline" onClick={() => void confirmPending("discard")}>
                  Discard changes
                </Button>
                <AlertDialogAction onClick={() => void confirmPending("save")}>
                  Save and switch
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pending?.kind === "delete-note" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{pending.note.title}&rdquo; will be deleted permanently.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void confirmPending("delete")}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pending?.kind === "delete-collection" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{pending.collection.name}&rdquo; will be deleted. Its notes are kept and
                  move to Uncollected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void confirmPending("delete")}>
                  Delete collection
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
