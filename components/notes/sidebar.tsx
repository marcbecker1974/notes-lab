"use client";

import { useState, type FormEvent } from "react";
import { ChevronRight, Folder, FolderPlus, Inbox, Library, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { NAME_MAX, type Collection, type Note, type Tag } from "@/lib/notes-db";
import { notesInView, sameView, type View } from "@/lib/notes-view";
import { cn } from "@/lib/utils";
import { NoteCard } from "./note-card";

type SidebarProps = {
  notes: Note[];
  collections: Collection[];
  tags: Tag[];
  view: View;
  expanded: Set<number | "uncollected">;
  selectedNoteId: number | null;
  selectedTagIds: number[];
  onSelectView: (view: View) => void;
  onToggleExpanded: (key: number | "uncollected") => void;
  onSelectNote: (id: number) => void;
  onToggleTag: (id: number) => void;
  onClearTags: () => void;
  /** Resolves to an error message, or null on success. */
  onCreateCollection: (name: string) => Promise<string | null>;
  onDeleteCollection: (collection: Collection) => void;
};

export function Sidebar(props: SidebarProps) {
  const {
    notes,
    collections,
    tags,
    view,
    expanded,
    selectedNoteId,
    selectedTagIds,
  } = props;
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    const error = await props.onCreateCollection(name);
    setCreating(false);
    setFormError(error);
    if (!error) setName("");
  }

  const rowClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active && "bg-accent font-medium",
    );

  const uncollected = notesInView(notes, { kind: "uncollected" });

  return (
    <aside aria-label="Collections and tags" className="flex h-full min-h-0 flex-col border-r">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <nav aria-label="Collections" className="space-y-0.5">
            <div className="flex items-center">
              <button
                type="button"
                className={rowClass(view.kind === "all")}
                onClick={() => props.onSelectView({ kind: "all" })}
              >
                <Library className="h-4 w-4 shrink-0" />
                <span className="truncate">All notes</span>
              </button>
            </div>

            <Collapsible
              open={expanded.has("uncollected")}
              onOpenChange={() => props.onToggleExpanded("uncollected")}
            >
              <div className="flex items-center">
                <Chevron open={expanded.has("uncollected")} onClick={() => props.onToggleExpanded("uncollected")} label="Uncollected" />
                <button
                  type="button"
                  className={rowClass(view.kind === "uncollected")}
                  onClick={() => props.onSelectView({ kind: "uncollected" })}
                >
                  <Inbox className="h-4 w-4 shrink-0" />
                  <span className="truncate">Uncollected</span>
                </button>
              </div>
              <CollapsibleContent className="ml-6 space-y-0.5 py-0.5">
                {uncollected.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No notes</p>
                ) : (
                  uncollected.map((note) => (
                    <NoteCard
                      key={note.id}
                      compact
                      note={note}
                      tags={tags}
                      selected={note.id === selectedNoteId}
                      onSelect={props.onSelectNote}
                    />
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator className="my-2" />

            {collections.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No collections yet. Create one below.
              </p>
            )}
            {collections.map((collection) => {
              const open = expanded.has(collection.id);
              const inCollection = notesInView(notes, { kind: "collection", id: collection.id });
              return (
                <Collapsible
                  key={collection.id}
                  open={open}
                  onOpenChange={() => props.onToggleExpanded(collection.id)}
                >
                  <div className="group flex items-center">
                    <Chevron open={open} onClick={() => props.onToggleExpanded(collection.id)} label={collection.name} />
                    <button
                      type="button"
                      className={rowClass(sameView(view, { kind: "collection", id: collection.id }))}
                      onClick={() => props.onSelectView({ kind: "collection", id: collection.id })}
                    >
                      <Folder className="h-4 w-4 shrink-0" />
                      <span className="truncate">{collection.name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete collection ${collection.name}`}
                      onClick={() => props.onDeleteCollection(collection)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CollapsibleContent className="ml-6 space-y-0.5 py-0.5">
                    {inCollection.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No notes in this collection yet
                      </p>
                    ) : (
                      inCollection.map((note) => (
                        <NoteCard
                          key={note.id}
                          compact
                          note={note}
                          tags={tags}
                          selected={note.id === selectedNoteId}
                          onSelect={props.onSelectNote}
                        />
                      ))
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>

          <Separator />

          <section aria-label="Filter by tags" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </h2>
              {selectedTagIds.length > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={props.onClearTags}>
                  Clear
                </Button>
              )}
            </div>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags yet. Add one to a note.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => props.onToggleTag(tag.id)}
                      className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
                        {tag.name}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="space-y-1.5 border-t p-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            aria-label="New collection name"
            maxLength={NAME_MAX * 2}
          />
          <Button type="submit" size="icon" disabled={creating} aria-label="Create collection">
            <FolderPlus />
          </Button>
        </div>
        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}
      </form>
    </aside>
  );
}

function Chevron({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-6 shrink-0"
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      aria-expanded={open}
      onClick={onClick}
    >
      <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
    </Button>
  );
}
