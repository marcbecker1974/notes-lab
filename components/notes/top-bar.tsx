"use client";

import { BookOpen, PanelLeft, Plus, Search } from "lucide-react";
import Link from "next/link";

import { AuthStatus } from "./auth-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TopBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  creating: boolean;
  onNewNote: () => void;
  /** Phone, editor screen: the editor has its own back bar instead. */
  hiddenOnPhone: boolean;
};

// Shared header over the notes list and the editor: the search field, plus (below
// 1200px, where the sidebar is a drawer) the menu button and a New note button (icon
// only on phones). The sign-in status (email and Logout, or Login) sits at the end from
// 768px up; below that it is shown next to the app title in the sidebar drawer.
// On a phone this bar belongs to the list screen only (`hiddenOnPhone` on the editor screen).
export function TopBar(props: TopBarProps) {
  return (
    <div className={cn("flex items-center gap-3 md:col-span-2", props.hiddenOnPhone && "max-md:hidden")}>
      {/* Visible below 1200px, where the sidebar is a drawer. */}
      <Button
        variant="outline"
        size="icon"
        className="hidden h-11 w-11 shrink-0 bg-background max-[1199px]:inline-flex"
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
      {/* The sidebar has the primary New note button; this one is for widths below 1200px. */}
      <Button
        className="hidden h-11 max-[1199px]:inline-flex max-sm:w-11 max-sm:px-0"
        onClick={props.onNewNote}
        disabled={props.creating}
        aria-label="New note"
      >
        <Plus /> <span className="max-sm:sr-only">New note</span>
      </Button>
      <Button asChild variant="ghost" className="h-11 max-sm:w-11 max-sm:px-0">
        <Link href="/library" aria-label="My library">
          <BookOpen /> <span className="max-sm:sr-only">My library</span>
        </Link>
      </Button>
      <AuthStatus className="max-md:hidden" />
    </div>
  );
}
