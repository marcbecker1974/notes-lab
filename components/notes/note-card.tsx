import { cn } from "@/lib/utils";
import type { Note, Tag } from "@/lib/notes-db";
import { TagChip } from "./tag-chip";

type NoteCardProps = {
  note: Note;
  tags: Tag[]; // all tags; the card resolves its own from note.tagIds
  selected: boolean;
  onSelect: (id: number) => void;
  compact?: boolean; // sidebar variant: title and tags only
};

export function NoteCard({ note, tags, selected, onSelect, compact }: NoteCardProps) {
  const noteTags = note.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined);

  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected ? "border-primary bg-accent" : "border-transparent",
        compact ? "py-1.5" : "border-border",
      )}
    >
      <span className="block truncate text-sm font-medium">{note.title}</span>
      {!compact && note.body && (
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
          {note.body}
        </span>
      )}
      {noteTags.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {noteTags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </span>
      )}
    </button>
  );
}
