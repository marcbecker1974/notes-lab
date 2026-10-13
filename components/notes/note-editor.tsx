"use client";

import { useState, type FormEvent } from "react";
import { Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  NAME_MAX,
  NOTE_BODY_MAX,
  NOTE_TITLE_MAX,
  type Collection,
  type Note,
  type Tag,
} from "@/lib/notes-db";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export type Draft = { title: string; body: string };

type NoteEditorProps = {
  note: Note | null;
  draft: Draft | null;
  dirty: boolean;
  saving: boolean;
  collections: Collection[];
  tags: Tag[];
  onDraftChange: (draft: Draft) => void;
  onSave: () => void;
  onMove: (collectionId: number | null) => void;
  /** Resolves to an error message, or null on success. */
  onAddTag: (name: string) => Promise<string | null>;
  onRemoveTag: (tagId: number) => void;
  onDelete: () => void;
};

const NONE = "none";

const count = (value: string) => Array.from(value).length;

export function NoteEditor(props: NoteEditorProps) {
  const { note, draft } = props;

  if (!note || !draft) {
    return (
      <section aria-label="Editor" className="flex h-full items-center justify-center">
        <EmptyState title="No note selected">
          Pick a note from the list or create a new one.
        </EmptyState>
      </section>
    );
  }

  const titleLength = count(draft.title);
  const bodyLength = count(draft.body);
  const titleBad = draft.title.trim() === "" || titleLength > NOTE_TITLE_MAX;
  const bodyBad = bodyLength > NOTE_BODY_MAX;

  return (
    <section aria-label="Editor" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <p
          className={cn("text-xs", props.dirty ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}
          aria-live="polite"
        >
          {props.dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={props.onDelete}>
            <Trash2 /> Delete
          </Button>
          <Button
            size="sm"
            onClick={props.onSave}
            disabled={!props.dirty || props.saving || titleBad || bodyBad}
          >
            {props.saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[900px] space-y-6 px-6 py-8">
          <div className="space-y-1.5">
            <Label htmlFor="note-title" className="sr-only">
              Title
            </Label>
            <Input
              id="note-title"
              value={draft.title}
              onChange={(event) => props.onDraftChange({ ...draft, title: event.target.value })}
              aria-invalid={titleBad}
              placeholder="Title"
              className="h-auto border-0 border-b rounded-none bg-transparent px-0 py-2 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-3xl"
            />
            <Counter value={titleLength} max={NOTE_TITLE_MAX} />
            {draft.title.trim() === "" && (
              <p className="text-xs text-destructive">A note needs a title.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-body" className="sr-only">
              Note
            </Label>
            <Textarea
              id="note-body"
              value={draft.body}
              onChange={(event) => props.onDraftChange({ ...draft, body: event.target.value })}
              className="min-h-[400px] resize-y bg-card p-4 text-base leading-7 shadow-sm md:text-base"
              placeholder="Write your note..."
              aria-invalid={bodyBad}
            />
            <Counter value={bodyLength} max={NOTE_BODY_MAX} />
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-[220px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="note-collection" className="text-xs text-muted-foreground">
                Collection
              </Label>
              <Select
                value={note.collectionId === null ? NONE : String(note.collectionId)}
                onValueChange={(value) => props.onMove(value === NONE ? null : Number(value))}
              >
                <SelectTrigger id="note-collection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (Uncollected)</SelectItem>
                  {props.collections.map((collection) => (
                    <SelectItem key={collection.id} value={String(collection.id)}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          <TagEditor
            key={note.id}
            note={note}
            tags={props.tags}
            onAddTag={props.onAddTag}
            onRemoveTag={props.onRemoveTag}
          />
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p className={cn("text-right text-xs", value > max ? "text-destructive" : "text-muted-foreground")}>
      {value} / {max}
    </p>
  );
}

function TagEditor({
  note,
  tags,
  onAddTag,
  onRemoveTag,
}: {
  note: Note;
  tags: Tag[];
  onAddTag: (name: string) => Promise<string | null>;
  onRemoveTag: (tagId: number) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noteTags = note.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined);
  const needle = text.trim().toLowerCase();
  const suggestions = tags
    .filter((tag) => !note.tagIds.includes(tag.id))
    .filter((tag) => needle === "" || tag.name.toLowerCase().includes(needle))
    .slice(0, 8);

  async function add(name: string) {
    setBusy(true);
    const message = await onAddTag(name);
    setBusy(false);
    setError(message);
    if (!message) setText("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void add(text);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="note-tag" className="text-xs text-muted-foreground">
        Tags
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {noteTags.length === 0 && (
          <p className="text-xs text-muted-foreground">No tags on this note.</p>
        )}
        {noteTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
            {tag.name}
            <button
              type="button"
              onClick={() => onRemoveTag(tag.id)}
              aria-label={`Remove tag ${tag.name}`}
              className="rounded-sm p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          id="note-tag"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a tag and press Enter"
          maxLength={NAME_MAX * 2}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Existing:</span>
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={busy}
              onClick={() => void add(tag.name)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Badge variant="outline" className="cursor-pointer">
                + {tag.name}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
