import { cn } from "@/lib/utils";
import type { Note, Tag } from "@/lib/notes-db";
import { TagChip } from "./tag-chip";
import { compactPreview } from "@/lib/rich-text/preview";

type NoteCardProps = {
  note: Note;
  tags: Tag[]; // all tags; the card resolves its own from note.tagIds
  selected: boolean;
  onSelect: (id: number) => void;
};

export function NoteCard({ note, tags, selected, onSelect }: NoteCardProps) {
  const noteTags = note.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined);
  const date = new Date(note.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block w-full border-b border-border/70 px-5 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        selected &&
          "bg-blue-50 shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-blue-50 dark:bg-primary/15 dark:hover:bg-primary/15",
      )}
    >
      <span className="block truncate text-base font-semibold leading-5">{note.title}</span>
      {note.body && (
        <span className="mt-1 line-clamp-3 break-words text-[13px] leading-5 text-muted-foreground">
          {compactPreview(note.body)}
        </span>
      )}
      <span className="mt-2 flex items-end justify-between gap-3">
        <span className="flex flex-wrap gap-1.5">
          {noteTags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground/80">{date}</span>
      </span>
    </button>
  );
}
