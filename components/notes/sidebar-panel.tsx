"use client";

import { useEffect, type ComponentProps } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

type SidebarPanelProps = ComponentProps<typeof Sidebar> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while a dialog is open: its Escape must not also close the panel. */
  suspendEscape: boolean;
};

// Wraps the sidebar. Wide desktop and mobile: a plain column. Medium widths
// (768-1199px): hidden until toggled, then a 260px overlay with a backdrop.
export function SidebarPanel({ open, onOpenChange, suspendEscape, ...sidebar }: SidebarPanelProps) {
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
            ? "flex min-h-0 flex-col md:max-[1199px]:absolute md:max-[1199px]:inset-y-0 md:max-[1199px]:left-0 md:max-[1199px]:z-30 md:max-[1199px]:w-[260px] md:max-[1199px]:bg-background md:max-[1199px]:shadow-xl"
            : "flex min-h-0 flex-col md:max-[1199px]:hidden"
        }
      >
        <div className="hidden items-center justify-between border-b px-3 py-2 md:max-[1199px]:flex">
          <span className="text-sm font-semibold">Collections</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Hide collections" onClick={() => onOpenChange(false)}>
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
          className="hidden md:max-[1199px]:fixed md:max-[1199px]:inset-0 md:max-[1199px]:z-20 md:max-[1199px]:block md:max-[1199px]:bg-black/30"
          onClick={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
