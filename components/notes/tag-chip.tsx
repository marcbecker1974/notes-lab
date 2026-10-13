import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/lib/notes-db";
import { PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <Badge
      variant="soft"
      className={cn("px-2.5 py-0.5 text-xs font-medium", PALETTE[tag.color].badge)}
    >
      {tag.name}
    </Badge>
  );
}
