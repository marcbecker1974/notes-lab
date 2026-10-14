"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Folder, Inbox, Library, NotebookPen, Plus, Trash2 } from "lucide-react";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NAME_MAX, type Collection, type Note, type Tag } from "@/lib/notes-db";
import { countNotes, countTagUses, sameView, type View } from "@/lib/notes-view";
import { PALETTE, type PaletteKey } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { ColorSwatchMenu } from "./color-swatch-menu";
import { AuthStatus } from "./auth-status";

type SidebarProps = {
  notes: Note[];
  collections: Collection[];
  tags: Tag[];
  view: View;
  selectedTagIds: number[];
  deleting: boolean;
  onSelectView: (view: View) => void;
  onToggleTag: (id: number) => void;
  onClearTags: () => void;
  /** Both create callbacks resolve to an error message, or null on success. */
  onCreateCollection: (name: string) => Promise<string | null>;
  onCreateTag: (name: string) => Promise<string | null>;
  onDeleteCollection: (collection: Collection) => void;
  onChangeCollectionColor: (id: number, color: PaletteKey) => void;
  onChangeTagColor: (id: number, color: PaletteKey) => void;
  onNewNote: () => void;
  creatingNote: boolean;
};

type Creating = "collection" | "tag" | null;

export function Sidebar(props: SidebarProps) {
  const { notes, collections, tags, view, selectedTagIds } = props;
  const [creating, setCreating] = useState<Creating>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => countNotes(notes), [notes]);
  const tagUses = useMemo(() => countTagUses(notes), [notes]);

  function toggleForm(kind: Exclude<Creating, null>) {
    setCreating((current) => (current === kind ? null : kind));
    setName("");
    setFormError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!creating) return;
    setBusy(true);
    const error = await (creating === "collection" ? props.onCreateCollection(name) : props.onCreateTag(name));
    setBusy(false);
    setFormError(error);
    if (!error) {
      setName("");
      setCreating(null);
    }
  }

  // The row wrapper carries hover and selected colour; its buttons stay transparent.
  const rowWrap = (active: boolean) =>
    cn("group relative flex items-center rounded-lg", active ? "bg-blue-50 dark:bg-primary/15" : "hover:bg-accent/60");
  const rowButton = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5 pl-3 pr-3 text-left text-[15px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active ? "font-semibold" : "font-medium",
    );

  return (
    <aside aria-label="Collections and tags" className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="space-y-4 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Notes Lab</span>
          {/* Below 768px only; the top bar shows it from 768px up. */}
          <AuthStatus className="ml-auto md:hidden" />
        </div>
        <Button className="h-11 w-full text-[15px]" onClick={props.onNewNote} disabled={props.creatingNote}>
          <Plus /> New note
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-4 pb-4 pt-1">
          <nav aria-label="Collections" className="space-y-1">
            <div className={rowWrap(view.kind === "all")}>
              <button
                type="button"
                className={rowButton(view.kind === "all")}
                aria-current={view.kind === "all" ? "true" : undefined}
                onClick={() => props.onSelectView({ kind: "all" })}
              >
                <Library className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate">All notes</span>
                <CountBadge count={counts.all} />
              </button>
            </div>

            <SectionHeading
              title="Collections"
              addLabel="Add collection"
              open={creating === "collection"}
              onToggle={() => toggleForm("collection")}
            />
            {creating === "collection" && (
              <CreateForm
                label="New collection name"
                submitLabel="Create collection"
                placeholder="Collection name"
                name={name}
                busy={busy}
                error={formError}
                onName={setName}
                onSubmit={submit}
              />
            )}

            <div className={rowWrap(view.kind === "uncollected")}>
              <button
                type="button"
                className={rowButton(view.kind === "uncollected")}
                onClick={() => props.onSelectView({ kind: "uncollected" })}
              >
                <Inbox className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate">Uncollected</span>
                <CountBadge count={counts.uncollected} />
              </button>
            </div>
            {collections.map((collection) => {
              const active = sameView(view, { kind: "collection", id: collection.id });
              return (
                <div key={collection.id} className={rowWrap(active)}>
                  <ColorSwatchMenu
                    value={collection.color}
                    subject={`collection ${collection.name}`}
                    onChange={(color) => props.onChangeCollectionColor(collection.id, color)}
                    triggerClassName="ml-1.5 h-8 w-8"
                  >
                    <Folder
                      fill="currentColor"
                      fillOpacity={0.3}
                      className={cn("h-5 w-5", PALETTE[collection.color].folder)}
                    />
                  </ColorSwatchMenu>
                  <button
                    type="button"
                    className={cn(rowButton(active), "pl-2")}
                    aria-current={active ? "true" : undefined}
                    onClick={() => props.onSelectView({ kind: "collection", id: collection.id })}
                  >
                    <span className="truncate">{collection.name}</span>
                    <CountBadge count={counts.byCollection.get(collection.id) ?? 0} />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 bg-accent opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete collection ${collection.name}`}
                    disabled={props.deleting}
                    onClick={() => props.onDeleteCollection(collection)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </nav>

          <section aria-label="Filter by tags" className="space-y-1">
            <SectionHeading
              title="Tags"
              addLabel="Add tag"
              open={creating === "tag"}
              onToggle={() => toggleForm("tag")}
              extra={
                selectedTagIds.length > 0 ? (
                  <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={props.onClearTags}>
                    Clear
                  </Button>
                ) : null
              }
            />
            {creating === "tag" && (
              <CreateForm
                label="New tag name"
                submitLabel="Create tag"
                placeholder="Tag name"
                name={name}
                busy={busy}
                error={formError}
                onName={setName}
                onSubmit={submit}
              />
            )}
            {tags.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">No tags yet. Add one to a note.</p>
            ) : (
              tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <div key={tag.id} className={rowWrap(active)}>
                    <ColorSwatchMenu
                      value={tag.color}
                      subject={`tag ${tag.name}`}
                      onChange={(color) => props.onChangeTagColor(tag.id, color)}
                      triggerClassName="ml-1.5 h-8 w-8"
                    >
                      <span className={cn("h-3.5 w-3.5 rounded-full", PALETTE[tag.color].dot)} />
                    </ColorSwatchMenu>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => props.onToggleTag(tag.id)}
                      className={cn(rowButton(active), "pl-2")}
                    >
                      <span className="truncate">{tag.name}</span>
                      <CountBadge count={tagUses.get(tag.id) ?? 0} />
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

function SectionHeading({
  title,
  addLabel,
  open,
  onToggle,
  extra,
}: {
  title: string;
  addLabel: string;
  open: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        {extra}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          aria-label={addLabel}
          aria-expanded={open}
          onClick={onToggle}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CreateForm({
  label,
  submitLabel,
  placeholder,
  name,
  busy,
  error,
  onName,
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  placeholder: string;
  name: string;
  busy: boolean;
  error: string | null;
  onName: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-1.5 pb-2 pt-1">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          maxLength={NAME_MAX * 2}
        />
        <Button type="submit" disabled={busy} aria-label={submitLabel}>
          Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

// A span (valid inside a button); the screen-reader text gives "3 notes" with the right plural.
function CountBadge({ count }: { count: number }) {
  return (
    <span className={cn(badgeVariants({ variant: "count" }), "ml-auto shrink-0 text-xs")}>
      {count}
      <span className="sr-only">&nbsp;{count === 1 ? "note" : "notes"}</span>
    </span>
  );
}
