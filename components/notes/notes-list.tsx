"use client";

import { Folder } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note, Tag } from "@/lib/notes-db";
import { PALETTE, type PaletteKey } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { NOTE_SORTS, NOTE_SORT_LABELS, isNoteSort, type EmptyReason, type NoteSort } from "@/lib/notes-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "./empty-state";
import { NoteCard } from "./note-card";

type NotesListProps = {
  title: string; // name of the current view
  titleColor: PaletteKey | null; // set when the view is a collection
  notes: Note[]; // already filtered
  empty: EmptyReason | null;
  emptyViewMessage: string; // wording for "no-notes" in this view
  tags: Tag[];
  selectedNoteId: number | null;
  query: string;
  filtersActive: boolean;
  sort: NoteSort;
  onSortChange: (sort: NoteSort) => void;
  onSelectNote: (id: number) => void;
  onClearFilters: () => void;
};

export function NotesList(props: NotesListProps) {
  const { empty, query } = props;
  const emptyContent = (
    <>
      {empty === "no-notes" && <EmptyState title={props.emptyViewMessage} />}
          {empty === "no-tag-match" && (
      <EmptyState title="No notes carry all selected tags.">
        <Button variant="outline" size="sm" onClick={props.onClearFilters}>
          Clear tag filters
        </Button>
      </EmptyState>
    )}
    {empty === "no-search-match" && (
      <EmptyState title={`No notes match "${query.trim()}".`}>
        {props.filtersActive
          ? "Try a different search or clear the tag filters."
          : "Try a different search."}
        {props.filtersActive && (
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={props.onClearFilters}>
              Clear tag filters
            </Button>
          </div>
        )}
      </EmptyState>
    )}
    </>
  );

  return (
    <section aria-label="Notes" className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="flex items-baseline justify-between gap-2 border-b px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          {props.titleColor && (
            <Folder
              fill="currentColor"
              fillOpacity={0.3}
              className={cn("h-5 w-5 shrink-0 self-center", PALETTE[props.titleColor].folder)}
              aria-hidden="true"
            />
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight">{props.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.notes.length > 0 && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {props.notes.length} {props.notes.length === 1 ? "note" : "notes"}
            </p>
          )}
          <Select value={props.sort} onValueChange={(v) => isNoteSort(v) && props.onSortChange(v)}>
            <SelectTrigger aria-label="Sort notes" className="h-7 w-auto gap-1 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {NOTE_SORTS.map((value) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {NOTE_SORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div>
          {empty !== null && <div className="p-3">{emptyContent}</div>}
          {props.notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={props.tags}
              selected={note.id === props.selectedNoteId}
              onSelect={props.onSelectNote}
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
