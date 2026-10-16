"use client";

import { useEffect, useRef, useState } from "react";

import { createBackGuard } from "@/lib/back-guard";

// Binds the pure back guard (lib/back-guard.ts) to the browser history. `active` is "the open
// note has unsaved changes"; `onBlocked` runs when Back was pressed meanwhile (the page stays).
// Returns `leave`, which continues the Back after the user chose Save or Discard.
export function useBackGuard(active: boolean, onBlocked: () => void): () => void {
  const [guard] = useState(() =>
    createBackGuard({
      push: () => window.history.pushState(null, "", window.location.href),
      back: () => window.history.back(),
      go: (delta) => window.history.go(delta),
      length: () => window.history.length,
      later: (fn, ms) => void window.setTimeout(fn, ms),
    }),
  );
  const blocked = useRef(onBlocked);
  useEffect(() => {
    blocked.current = onBlocked;
  });

  useEffect(() => {
    const onPopState = () => {
      if (guard.onPopState() === "blocked") blocked.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [guard]);

  useEffect(() => {
    guard.setActive(active);
  }, [guard, active]);

  return guard.leave;
}
