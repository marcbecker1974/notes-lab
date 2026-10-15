"use client";

import { useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { Download, Folder, Trash2, X } from "lucide-react";

import { Badge, badgeVariants } from "@/components/ui/badge";
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
import { PALETTE, type PaletteKey } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { ColorSwatchMenu } from "./color-swatch-menu";
import { EmptyState } from "./empty-state";

export type Draft = { title: string; body: string };

type NoteEditorProps = {
  note: Note | null;
  draft: Draft | null;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  collections: Collection[];
  tags: Tag[];
  onDraftChange: (draft: Draft) => void;
  onSave: () => void;
  /** Puts the draft back to the last saved text. */
  onCancel: () => void;
  onMove: (collectionId: number | null) => void;
  /** Resolves to an error message, or null on success. */
  onAddTag: (name: string) => Promise<string | null>;
  onRemoveTag: (tagId: number) => void;
  onChangeTagColor: (id: number, color: PaletteKey) => void;
  /** Downloads the last saved version of the note as a Markdown file. */
  onExport: () => void;
  onDelete: () => void;
};

const NONE = "none";

const count = (value: string) => Array.from(value).length;

// "Last saved" is only shown when the timestamp parses.
function lastSaved(updatedAt: string): string | null {
  const time = Date.parse(updatedAt);
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function NoteEditor(props: NoteEditorProps) {
  const { note, draft } = props;

  if (!note || !draft) {
    return (
      <section aria-label="Editor" className="flex h-full items-center justify-center rounded-xl border border-border/70 bg-background">
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
  const saved = lastSaved(note.updatedAt);

  return (
    <section aria-label="Editor" className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <p
          className={cn(
            "min-w-0 flex-1 basis-40 text-sm",
            props.dirty ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {props.dirty ? "Unsaved changes. Export uses the last saved version." : "All changes saved"}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onExport}
            aria-label="Export note as Markdown"
            title={
              props.dirty
                ? "Export the last saved version as Markdown (unsaved changes are not included)"
                : "Export note as Markdown"
            }
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={props.onDelete}
            disabled={props.deleting}
            aria-label="Delete note"
            title="Delete note"
          >
            <Trash2 />
          </Button>
          <Button variant="outline" onClick={props.onCancel} disabled={!props.dirty || props.saving}>
            Cancel
          </Button>
          <Button
            onClick={props.onSave}
            disabled={!props.dirty || props.saving || titleBad || bodyBad}
          >
            {props.saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[1100px] space-y-3 px-8 py-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="note-title" required>
              Title
            </FieldLabel>
            <Input
              id="note-title"
              value={draft.title}
              onChange={(event) => props.onDraftChange({ ...draft, title: event.target.value })}
              aria-invalid={titleBad}
              aria-describedby={draft.title.trim() === "" ? "note-title-error" : undefined}
              placeholder="Title"
              className="h-12 text-lg font-semibold shadow-none md:text-lg"
            />
            <Counter value={titleLength} max={NOTE_TITLE_MAX} />
            {draft.title.trim() === "" && (
              <p id="note-title-error" role="alert" className="text-sm text-destructive">
                A note needs a title.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(11rem,2fr)_minmax(0,3fr)]">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="note-collection">Collection</FieldLabel>
              <Select
                value={note.collectionId === null ? NONE : String(note.collectionId)}
                onValueChange={(value) => props.onMove(value === NONE ? null : Number(value))}
              >
                <SelectTrigger id="note-collection" className="h-12 text-lg shadow-none md:text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (Uncollected)</SelectItem>
                  {props.collections.map((collection) => (
                    <SelectItem key={collection.id} value={String(collection.id)}>
                      <span className="flex items-center gap-2">
                        <Folder
                          fill="currentColor"
                          fillOpacity={0.3}
                          className={cn("h-4 w-4 shrink-0", PALETTE[collection.color].folder)}
                        />
                        {collection.name}
                      </span>
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
              onChangeTagColor={props.onChangeTagColor}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="note-body" required>
              Content
            </FieldLabel>
            <Textarea
              id="note-body"
              value={draft.body}
              onChange={(event) => props.onDraftChange({ ...draft, body: event.target.value })}
              className="min-h-[460px] resize-y border-border p-6 text-[17px] leading-[1.4] shadow-none md:text-[17px]"
              placeholder="Write your note..."
              aria-invalid={bodyBad}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {saved ? `Last saved: ${saved}` : ""}
              </p>
              <Counter value={bodyLength} max={NOTE_BODY_MAX} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: string;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[15px] font-semibold">
      {children}
      {required && (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      )}
    </Label>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p className={cn("text-right text-[11px]", value > max ? "text-destructive" : "text-muted-foreground/60")}>
      {value} / {max}
    </p>
  );
}

function TagEditor({
  note,
  tags,
  onAddTag,
  onRemoveTag,
  onChangeTagColor,
}: {
  note: Note;
  tags: Tag[];
  onAddTag: (name: string) => Promise<string | null>;
  onRemoveTag: (tagId: number) => void;
  onChangeTagColor: (id: number, color: PaletteKey) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Existing tags are offered only while the field is in use (focus or typing).
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Close when focus leaves the whole tag editor (not when it moves to a suggestion).
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      inputRef.current?.focus();
      return;
    }
    if (!open || suggestions.length === 0) return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(index + 1, items.length - 1)]?.focus();
    } else if (event.key === "ArrowUp" && index >= 0) {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else items[index - 1]?.focus();
    }
  }

  return (
    <div className="relative space-y-1.5" onBlur={onBlur} onKeyDown={onKeyDown}>
      <FieldLabel htmlFor="note-tag">Tags</FieldLabel>
      <form
        onSubmit={submit}
        className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring"
      >
        {noteTags.map((tag) => (
          <Badge key={tag.id} variant="soft" className={cn("gap-1 py-0.5 pl-1 pr-1 text-sm", PALETTE[tag.color].badge)}>
            <ColorSwatchMenu
              value={tag.color}
              subject={`tag ${tag.name}`}
              onChange={(color) => onChangeTagColor(tag.id, color)}
              triggerClassName="h-5 w-5 rounded-full hover:bg-black/10"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", PALETTE[tag.color].dot)} />
            </ColorSwatchMenu>
            {tag.name}
            <button
              type="button"
              onClick={() => onRemoveTag(tag.id)}
              aria-label={`Remove tag ${tag.name}`}
              className="rounded-sm p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        ))}
        <input
          id="note-tag"
          ref={inputRef}
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          aria-controls="note-tag-suggestions"
          placeholder={noteTags.length === 0 ? "No tags yet. Add a tag..." : "Add a tag..."}
          maxLength={NAME_MAX * 2}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {open && suggestions.length > 0 && (
        <div
          id="note-tag-suggestions"
          ref={listRef}
          role="group"
          aria-label="Existing tags"
          // Keep focus where it is when a suggestion is pressed (also on touch screens).
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 right-0 top-full z-20 mt-1 flex flex-wrap items-center gap-1.5 rounded-md border bg-popover p-2 shadow-sm"
        >
          <span className="text-xs text-muted-foreground">Existing:</span>
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={busy}
              onClick={() => void add(tag.name).then(() => inputRef.current?.focus())}
              className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer gap-1.5")}>
                <span className={cn("h-2 w-2 rounded-full", PALETTE[tag.color].dot)} />
                + {tag.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
