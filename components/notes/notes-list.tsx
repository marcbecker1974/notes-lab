"use client";

import { PanelLeft, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note, Tag } from "@/lib/notes-db";
import type { EmptyReason } from "@/lib/notes-view";
import { EmptyState } from "./empty-state";
import { NoteCard } from "./note-card";

type NotesListProps = {
  title: string; // name of the current view
  notes: Note[]; // already filtered
  empty: EmptyReason | null;
  emptyViewMessage: string; // wording for "no-notes" in this view
  tags: Tag[];
  selectedNoteId: number | null;
  query: string;
  filtersActive: boolean;
  creating: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onQueryChange: (query: string) => void;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onClearFilters: () => void;
};

export function NotesList(props: NotesListProps) {
  const { empty, query } = props;
  return (
    <section aria-label="Notes" className="flex h-full min-h-0 flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Visible only at medium widths, where the sidebar is collapsible. */}
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 shrink-0 md:max-[1199px]:inline-flex"
              aria-label={props.sidebarOpen ? "Hide collections" : "Show collections"}
              aria-expanded={props.sidebarOpen}
              aria-controls="collections-panel"
              onClick={props.onToggleSidebar}
            >
              <PanelLeft />
            </Button>
            <h1 className="truncate text-base font-semibold">{props.title}</h1>
          </div>
          <Button size="sm" onClick={props.onNewNote} disabled={props.creating}>
            <Plus /> New note
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="Search titles and text"
            aria-label="Search notes"
            className="pl-8"
          />
        </div>
        {props.notes.length > 0 && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {props.notes.length} {props.notes.length === 1 ? "note" : "notes"}
          </p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
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
