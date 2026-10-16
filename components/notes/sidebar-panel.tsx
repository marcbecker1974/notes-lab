"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { makeInert, nextFocusIndex } from "@/lib/back-guard";
import { Sidebar } from "./sidebar";

type SidebarPanelProps = ComponentProps<typeof Sidebar> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while a dialog is open: its Escape must not also close the panel. */
  suspendEscape: boolean;
};

// Wraps the sidebar. Wide desktop (1200px and up): a plain column. Below that, medium
// widths and phones: hidden until the menu button toggles it, then an overlay drawer
// (260px, or 85% of a narrow screen) with a backdrop. While it is open as a drawer it is
// modal: focus moves in and stays in (Tab wraps), everything behind it is inert, and
// Escape, the backdrop or the close button close it and focus returns to the menu button.
export function SidebarPanel({ open, onOpenChange, suspendEscape, ...sidebar }: SidebarPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // True below 1200px, where the sidebar is a drawer (it may still be "open" after a resize to desktop).
  const [isDrawer, setIsDrawer] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1199px)");
    const update = () => setIsDrawer(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const modal = open && isDrawer;

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

  // Everything outside the drawer (and its backdrop) cannot be focused or clicked while it is open.
  useEffect(() => {
    const panel = panelRef.current;
    if (!modal || !panel) return;
    const outside = new Set<HTMLElement>();
    for (const root of [panel.parentElement, panel.parentElement?.parentElement]) {
      for (const child of Array.from(root?.children ?? [])) {
        if (child instanceof HTMLElement && child !== panel && child !== backdropRef.current && !child.contains(panel)) {
          outside.add(child);
        }
      }
    }
    return makeInert([...outside]);
  }, [modal]);

  useEffect(() => {
    // Escape and Tab that belong to an open dialog or menu must not also act on the sidebar.
    if (!open || suspendEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onOpenChange(false);
      if (event.key !== "Tab" || event.defaultPrevented || !modal || !panelRef.current) return;
      // Focus in a menu or dialog opened from the drawer (rendered outside it) is theirs to manage.
      const active = document.activeElement;
      if (active !== document.body && !panelRef.current.contains(active)) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const next = nextFocusIndex(focusable.length, focusable.indexOf(document.activeElement as HTMLElement), event.shiftKey);
      if (next >= 0) {
        event.preventDefault();
        focusable[next].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, modal, suspendEscape, onOpenChange]);

  return (
    <>
      <div
        id="collections-panel"
        ref={panelRef}
        role={modal ? "dialog" : undefined}
        aria-modal={modal ? true : undefined}
        aria-label={modal ? "Collections and tags" : undefined}
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
          ref={backdropRef}
          aria-hidden="true"
          className="hidden max-[1199px]:fixed max-[1199px]:inset-0 max-[1199px]:z-20 max-[1199px]:block max-[1199px]:bg-black/30"
          onClick={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
