"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PALETTE, PALETTE_KEYS, type PaletteKey } from "@/lib/palette";
import { cn } from "@/lib/utils";

type ColorSwatchMenuProps = {
  value: PaletteKey;
  /** Names the item whose colour changes, for example `tag "rag"`. */
  subject: string;
  onChange: (color: PaletteKey) => void;
  /** The trigger button's content; the button itself is rendered here. */
  children: ReactNode;
  triggerClassName?: string;
};

// A button that opens a 4 x 2 grid of the eight palette colours. It is always a
// separate control from whatever it sits next to, so clicking a name keeps its
// own action.
export function ColorSwatchMenu({
  value,
  subject,
  onChange,
  children,
  triggerClassName,
}: ColorSwatchMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Change colour of ${subject}`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          triggerClassName,
        )}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2">
        <DropdownMenuLabel className="px-1 pb-1.5 pt-0 text-xs font-normal text-muted-foreground">
          Colour
        </DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1">
          {PALETTE_KEYS.map((key) => (
            <DropdownMenuItem
              key={key}
              role="menuitemradio"
              aria-label={PALETTE[key].label}
              aria-checked={key === value}
              onSelect={() => {
                if (key !== value) onChange(key);
              }}
              className="h-7 w-7 justify-center rounded-full p-0"
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", PALETTE[key].dot)}>
                {key === value && <Check className="h-3 w-3 text-white" />}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
