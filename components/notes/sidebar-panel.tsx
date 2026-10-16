"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

type SidebarPanelProps = ComponentProps<typeof Sidebar> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while a dialog is open: its Escape must not also close the panel. */
  suspendEscape: boolean;
};

// Wraps the sidebar. Wide desktop (1200px and up): a plain column. Below that, medium
// widths and phones: hidden until the menu button toggles it, then an overlay drawer
// (260px, or 85% of a narrow screen) with a backdrop.
export function SidebarPanel({ open, onOpenChange, suspendEscape, ...sidebar }: SidebarPanelProps) {
  // Focus moves into the drawer when it opens and back to the menu button when it closes.
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) {
      document.querySelector<HTMLElement>('[aria-controls="collections-panel"]')?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    // Escape that belongs to an open dialog or menu must not also close the sidebar.
    if (!open || suspendEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, suspendEscape, onOpenChange]);

  return (
    <>
      <div
        id="collections-panel"
        className={
          open
            ? "flex min-h-0 flex-col max-[1199px]:absolute max-[1199px]:inset-y-3 max-[1199px]:left-3 max-[1199px]:z-30 max-[1199px]:w-[min(85vw,300px)] md:max-[1199px]:w-[260px] max-[1199px]:rounded-xl max-[1199px]:bg-background max-[1199px]:shadow-xl"
            : "flex min-h-0 flex-col max-[1199px]:hidden"
        }
      >
        <div className="hidden items-center justify-between border-b px-3 py-2 max-[1199px]:flex">
          <span className="text-sm font-semibold">Collections</span>
          <Button ref={closeRef} variant="ghost" size="icon" className="h-9 w-9" aria-label="Hide collections" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar {...sidebar} />
        </div>
      </div>
      {open && (
        <div
          aria-hidden="true"
          className="hidden max-[1199px]:fixed max-[1199px]:inset-0 max-[1199px]:z-20 max-[1199px]:block max-[1199px]:bg-black/30"
          onClick={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
