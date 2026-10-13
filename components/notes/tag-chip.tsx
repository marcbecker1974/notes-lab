import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/lib/notes-db";

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <Badge variant="secondary" className="px-2 py-0 text-[11px] font-medium">
      {tag.name}
    </Badge>
  );
}
