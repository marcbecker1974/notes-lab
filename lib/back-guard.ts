// Browser Back with unsaved changes (Feature 8.3 follow-up). Import-free so `npm run
// test:mobile` (plain Node) can test it with a fake history.
//
// While `active` (the open note has unsaved changes) one extra history entry is pushed on
// top of the page's own entry (same URL). Back (the phone's system gesture or the browser
// button) then only pops that entry: the page stays, the entry is pushed again and the
// caller asks Save / Discard / Cancel. When nothing is unsaved no entry exists and Back
// behaves exactly as before. Choosing Save or Discard calls `leave()`, which goes back
// past both entries to where the user was heading; when the page has no earlier entry
// (opened in a new tab) it only removes our entry, so no dead Back press is left behind.

export type BackGuardHost = {
  /** Adds a history entry with the same URL. */
  push: () => void;
  back: () => void;
  go: (delta: number) => void;
  /** Number of entries in the history (`history.length`). */
  length: () => number;
  /** Runs `fn` after `ms` milliseconds. */
  later: (fn: () => void, ms: number) => void;
};

export type PopResult = "ignored" | "blocked" | "none";

export function createBackGuard(host: BackGuardHost) {
  let active = false;
  let entry = false; // our extra entry is on top of the history
  let ignorePops = 0; // popstate events caused by our own back() / go()

  const drop = (undo: () => void) => {
    ignorePops++;
    entry = false;
    undo();
    // If the browser fired no event (nothing to go back to), do not swallow a real Back later.
    host.later(() => {
      ignorePops = 0;
    }, 500);
  };

  return {
    /** Call whenever "has unsaved changes" changes. */
    setActive(next: boolean) {
      active = next;
      if (active && !entry) {
        host.push();
        entry = true;
      } else if (!active && entry) {
        drop(() => host.back());
      }
    },
    /** Call from the popstate listener. "blocked" means: stay on the page and ask the user. */
    onPopState(): PopResult {
      if (ignorePops > 0) {
        ignorePops--;
        return "ignored";
      }
      if (entry && active) {
        host.push(); // the user's Back popped our entry: put it back, the page stays
        return "blocked";
      }
      entry = false;
      return "none";
    },
    /** The user chose Save or Discard: continue the Back they asked for. */
    leave() {
      if (!entry) host.go(-1);
      else if (host.length() >= 3) drop(() => host.go(-2));
      else drop(() => host.back());
    },
    get hasEntry() {
      return entry;
    },
  };
}

// Keyboard focus inside an open drawer.

/** The index Tab moves to inside `count` focusable controls; `current` -1 means focus is outside them. */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

type InertNode = { inert: boolean };

/** Makes the nodes inert and returns a function that puts every node back as it was. */
export function makeInert(nodes: InertNode[]): () => void {
  const before = nodes.map((node) => node.inert);
  for (const node of nodes) node.inert = true;
  return () => nodes.forEach((node, i) => (node.inert = before[i]));
}
