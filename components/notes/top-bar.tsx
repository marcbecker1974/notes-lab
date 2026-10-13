"use client";

import { PanelLeft, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TopBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  creating: boolean;
  onNewNote: () => void;
};

// Shared header over the notes list and the editor: the search field, plus (at
// medium widths only, where the sidebar is collapsed) the sidebar toggle and a
// New note button.
export function TopBar(props: TopBarProps) {
  return (
    <div className="flex items-center gap-3 md:col-span-2">
      {/* Visible only at medium widths, where the sidebar is collapsible. */}
      <Button
        variant="outline"
        size="icon"
        className="hidden h-11 w-11 shrink-0 bg-background md:max-[1199px]:inline-flex"
        aria-label={props.sidebarOpen ? "Hide collections" : "Show collections"}
        aria-expanded={props.sidebarOpen}
        aria-controls="collections-panel"
        onClick={props.onToggleSidebar}
      >
        <PanelLeft />
      </Button>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search titles and text"
          aria-label="Search notes"
          className="h-11 border-border/70 bg-background pl-10 text-base shadow-none md:text-base"
        />
      </div>
      {/* The sidebar has the primary New note button; this one is for medium widths. */}
      <Button className="hidden md:max-[1199px]:inline-flex" onClick={props.onNewNote} disabled={props.creating}>
        <Plus /> New note
      </Button>
    </div>
  );
}
