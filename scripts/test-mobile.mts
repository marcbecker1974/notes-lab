// Tests for the mobile layout (Feature 8.3). Run: npm run test:mobile
// Plain Node: the pane rules are pure functions; the layout is checked statically on the
// component source (the repository has no browser or component test runner, and none was
// added). Real viewport behaviour (320, 375, 430, 768px), touch, focus and scrolling are
// verified by the owner in a browser; see REFLECTION.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backAction, visiblePane } from "../lib/notes-mobile.ts";
import { createBackGuard, makeInert, nextFocusIndex, type BackGuardHost } from "../lib/back-guard.ts";

const read = (path: string) => readFileSync(path, "utf8");
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}
const app = read("components/notes/notes-app.tsx");
const topBar = read("components/notes/top-bar.tsx");
const panel = read("components/notes/sidebar-panel.tsx");
const editor = read("components/notes/note-editor.tsx");
const list = read("components/notes/notes-list.tsx");
const fn = (source: string, name: string) =>
  new RegExp(`const ${name} = [\\s\\S]*?\\n  \\};\\n`).exec(source)?.[0] ?? "";

// --- navigation states
test("pane: list by default, editor only for an existing selected note", () => {
  assert.equal(visiblePane("list", true), "list");
  assert.equal(visiblePane("list", false), "list");
  assert.equal(visiblePane("editor", true), "editor");
  assert.equal(visiblePane("editor", false), "list", "a deleted or missing note never leaves an empty editor screen");
});
test("back: unsaved changes ask first, a clean note goes straight back", () => {
  assert.equal(backAction(true), "ask");
  assert.equal(backAction(false), "go");
});

// --- opening, creating, saving, cancelling, deleting (static wiring)
test("opening a note (list tap, same note, new note) shows the editor screen", () => {
  assert.ok(/const open = [\s\S]*?setRequestedPane\("editor"\)/.test(app), "open() requests the editor");
  assert.ok(/if \(id === selectedNoteId\) \{[\s\S]*?setRequestedPane\("editor"\)/.test(app), "tapping the open note shows the editor");
  assert.ok(/const note = await data\.addNote\([\s\S]*?open\(note\)/.test(app), "a new note opens through open()");
});
test("back goes through the unsaved-changes dialog; only Discard restores the saved text", () => {
  const back = fn(app, "backToList");
  assert.ok(back.includes('backAction(dirty) === "ask"') && back.includes('kind: "navigate"'), "dirty back asks");
  assert.ok(/choice === "discard" && selectedNote/.test(back), "Discard restores the saved text");
  assert.ok(!/choice === "save"[^]*setDraft/.test(back), "Save keeps the draft that was just saved");
  assert.ok(app.includes("current.proceed(choice"), "the dialog passes the choice on");
  assert.ok(back.includes("if (saving) return") && /onClick=\{backToList\}\s+disabled=\{saving\}/.test(app), "no Back while a save runs (review finding)");
});
test("deleting the open note returns to the list", () => {
  assert.ok(/ok && selectedNoteId === current\.note\.id\) \{[\s\S]*?setRequestedPane\("list"\)/.test(app));
});
test("Save, Cancel and Delete stay in the editor header on every width", () => {
  for (const label of ["Cancel", "Save", 'aria-label="Delete note"', 'aria-label="Export note as Markdown"']) {
    assert.ok(editor.includes(label), label);
  }
  assert.ok(editor.includes("flex flex-wrap items-center justify-between"), "the header wraps instead of clipping");
});
test("no note is created by navigation (only the New note actions create)", () => {
  assert.equal((app.match(/data\.addNote\(/g) ?? []).length, 1);
  assert.ok(!/backToList[\s\S]{0,400}addNote/.test(fn(app, "backToList")));
});

// --- collections, tags, search, sorting stay reachable
test("the sidebar (collections and tags) is a drawer below 1200px, opened by a menu button", () => {
  assert.ok(topBar.includes("max-[1199px]:inline-flex") && !topBar.includes("md:max-[1199px]:inline-flex"));
  assert.ok(topBar.includes('aria-controls="collections-panel"') && topBar.includes("aria-expanded"));
  assert.ok(panel.includes("max-[1199px]:fixed") && panel.includes("max-[1199px]:hidden"));
  assert.ok(!/(^|[^:\w-])md:max-\[1199px\]:(absolute|fixed|hidden)/.test(panel.replace(/md:max-\[1199px\]:w-\[260px\]/g, "")));
});
test("search and sorting are on the list screen; sorting keeps its saved choice", () => {
  assert.ok(topBar.includes('aria-label="Search notes"'));
  assert.ok(list.includes('aria-label="Sort notes"') && app.includes("loadNoteSort"));
  assert.ok(topBar.includes("hiddenOnPhone") && app.includes('hiddenOnPhone={pane === "editor"}'));
});
test("tags, collection and the Markdown modes live in the editor, unchanged on the editor screen", () => {
  assert.ok(editor.includes("RichTextEditor") && editor.includes("note-collection"));
  assert.ok(read("components/notes/editor-toolbar.tsx").includes('aria-label="View mode"'));
});
test("logout stays reachable on a phone (status in the drawer header)", () => {
  assert.ok(read("components/notes/sidebar.tsx").includes('<AuthStatus className="ml-auto md:hidden" />'));
});

// --- accessibility and touch
test("mobile navigation accessibility: names, focus handling, Escape", () => {
  assert.ok(app.includes('aria-label="Back to notes list"'));
  assert.ok(topBar.includes('aria-label="New note"') && topBar.includes("sr-only"), "icon-only New note keeps its name");
  assert.ok(/closeRef\.current\?\.focus\(\)/.test(panel) && panel.includes('[aria-controls="collections-panel"]'), "focus into the drawer and back to the menu button");
  assert.ok(panel.includes('event.key === "Escape"'));
  assert.ok(app.includes("scrollIntoView") && app.includes('(max-width: 767px)'), "the open note is brought back into view on the phone list");
});
test("touch targets: 44px menu, search, New note and Back; 36px or more drawer and sort controls", () => {
  assert.ok(topBar.includes("h-11 w-11") && topBar.includes('className="hidden h-11 max-[1199px]'));
  assert.ok(app.includes('className="h-11 shrink-0'));
  assert.ok(panel.includes("h-9 w-9") && list.includes("h-9 w-auto"));
});
test("no clipping on narrow screens: smaller editor padding, dynamic viewport height, wrapping toolbar", () => {
  assert.ok(editor.includes("px-4 py-3 md:px-6") && editor.includes("px-4 py-4 md:px-8"));
  assert.ok(!app.includes("h-screen") && app.includes("h-dvh"));
  assert.ok(read("components/notes/editor-toolbar.tsx").includes("flex flex-wrap"));
  assert.ok(read("components/notes/markdown-preview.tsx").includes("md-table-wrap"), "wide tables scroll sideways inside their own box");
});


// --- system Back with unsaved changes (lib/back-guard.ts)
function fakeHistory(length = 5) {
  const calls: string[] = [];
  const timers: Array<() => void> = [];
  const host: BackGuardHost = {
    push: () => void calls.push("push"),
    back: () => void calls.push("back"),
    go: (n) => void calls.push(`go${n}`),
    length: () => length,
    later: (fn) => void timers.push(fn),
  };
  return { host, calls, timers };
}
test("back guard: nothing unsaved means no history entry and Back is untouched", () => {
  const { host, calls } = fakeHistory();
  const guard = createBackGuard(host);
  guard.setActive(false);
  assert.deepEqual(calls, []);
  assert.equal(guard.onPopState(), "none", "a normal Back is not blocked");
});
test("back guard: unsaved changes push one entry; Back is blocked and the entry is put back", () => {
  const { host, calls } = fakeHistory();
  const guard = createBackGuard(host);
  guard.setActive(true);
  guard.setActive(true);
  assert.deepEqual(calls, ["push"], "one entry, however often it is set");
  assert.equal(guard.onPopState(), "blocked");
  assert.deepEqual(calls, ["push", "push"], "the popped entry is pushed again: the page stays");
  assert.equal(guard.onPopState(), "blocked", "and again for every Back until the user decides");
});
test("back guard: saving or cancelling the edits drops the entry without treating it as a user Back", () => {
  const { host, calls } = fakeHistory();
  const guard = createBackGuard(host);
  guard.setActive(true);
  guard.setActive(false);
  assert.deepEqual(calls, ["push", "back"]);
  assert.equal(guard.onPopState(), "ignored", "the event caused by our own back()");
  assert.equal(guard.onPopState(), "none", "the next real Back is not swallowed");
});
test("back guard: Save or Discard continues the Back past both entries", () => {
  const { host, calls } = fakeHistory();
  const guard = createBackGuard(host);
  guard.setActive(true);
  guard.onPopState();
  guard.leave();
  assert.equal(calls.at(-1), "go-2");
  assert.equal(guard.onPopState(), "ignored");
  guard.setActive(false);
  assert.equal(calls.filter((c) => c === "back").length, 0, "no second back() after leaving");
});
test("back guard: with no earlier entry (new tab) leave only removes our entry, nothing is left armed or stale", () => {
  const { host, calls } = fakeHistory(2);
  const guard = createBackGuard(host);
  guard.setActive(true);
  guard.onPopState();
  guard.leave();
  assert.equal(calls.at(-1), "back", "go(-2) would be a silent no-op");
  assert.equal(calls.some((c) => c === "go-2"), false);
  assert.equal(guard.onPopState(), "ignored");
  assert.equal(guard.hasEntry, false);
  guard.setActive(false);
  assert.equal(guard.onPopState(), "none", "a later Back is a normal Back");
});
test("back guard: a missed event does not swallow a later Back (timeout resets the counter)", () => {
  const { host, timers } = fakeHistory();
  const guard = createBackGuard(host);
  guard.setActive(true);
  guard.setActive(false);
  timers.forEach((t) => t());
  assert.equal(guard.onPopState(), "none");
});
test("back guard: wired to the unsaved state, the dialog and the page (static)", () => {
  assert.ok(/useBackGuard\(dirty,/.test(app), "active exactly while dirty");
  assert.ok(/const leavePage = useBackGuard\([\s\S]*?kind: "navigate",[\s\S]*?leavePage\(\);/.test(app), "a blocked Back opens the Save / Discard / Cancel dialog");
  const hook = read("components/notes/use-back-guard.ts");
  assert.ok(hook.includes('addEventListener("popstate"') && hook.includes("history.pushState(null"));
  assert.ok(app.includes("beforeunload"), "reload and tab close keep their own protection");
  assert.ok(/proceed: \(choice\) => \{\s*if \(choice === "discard" && selectedNote\)/.test(app), "Discard resets the draft before leaving");
  assert.ok(/if \(!leavingRef\.current\) event\.preventDefault\(\)/.test(app) && app.includes("leavingRef.current = true"), "no second 'Leave site?' prompt after the user chose");
});

// --- drawer: focus, trap, inert background
test("drawer focus: Tab wraps inside the drawer in both directions", () => {
  assert.equal(nextFocusIndex(4, 3, false), 0);
  assert.equal(nextFocusIndex(4, 0, true), 3);
  assert.equal(nextFocusIndex(4, 1, false), 2);
  assert.equal(nextFocusIndex(4, -1, false), 0, "focus outside: enter at the first control");
  assert.equal(nextFocusIndex(4, -1, true), 3);
  assert.equal(nextFocusIndex(0, -1, false), -1, "nothing focusable: leave Tab alone");
});
test("drawer: the background is inert while open and restored exactly afterwards", () => {
  const a = { inert: false };
  const b = { inert: true }; // already inert before: stays inert afterwards
  const restore = makeInert([a, b]);
  assert.deepEqual([a.inert, b.inert], [true, true]);
  restore();
  assert.deepEqual([a.inert, b.inert], [false, true]);
});
test("drawer (static): modal only as a drawer, focus in and out, Escape, trap, backdrop outside the inert area", () => {
  assert.ok(panel.includes('role={modal ? "dialog" : undefined}') && panel.includes("aria-modal={modal ? true : undefined}"));
  assert.ok(panel.includes('matchMedia("(max-width: 1199px)")'), "not modal on wide desktop");
  assert.ok(panel.includes("makeInert(") && panel.includes("child !== backdropRef.current"));
  assert.ok(panel.includes('event.key !== "Tab"') && panel.includes("nextFocusIndex("));
  assert.ok(panel.includes('event.key === "Escape"'));
  assert.ok(panel.includes("closeRef.current?.focus()") && panel.includes('[aria-controls="collections-panel"]'));
  assert.ok(/if \(!open \|\| suspendEscape\) return;/.test(panel), "a dialog opened from the drawer keeps its own Escape and Tab");
});

// --- desktop regression (static)
test("desktop: wrappers are display: contents from 768px, the three-column grids are unchanged", () => {
  assert.ok(app.includes("min-[1200px]:grid-cols-[280px_minmax(0,1fr)]"));
  assert.ok(app.includes("md:grid-cols-[360px_minmax(0,1fr)] min-[1200px]:grid-cols-[420px_minmax(0,1fr)]"));
  assert.ok(app.includes("md:contents") && app.includes("md:hidden"), "Back button is phone-only");
  const hides = app.match(/pane === "(?:editor|list)" && "max-md:hidden"/g) ?? [];
  assert.equal(hides.length, 2, "a pane is hidden only on a phone and only by the pane state");
  assert.equal((app.match(/max-md:hidden/g) ?? []).length, 2);
  assert.ok(topBar.includes("max-md:hidden"), "the auth status keeps its place from 768px");
});
test("data layer, auth and Supabase are untouched", () => {
  for (const f of [app, topBar, panel, editor, list]) assert.ok(!/supabase\.from\(|createClient\(/.test(f), "no data access in the layout files");
  assert.ok(!/^import /m.test(read("lib/notes-mobile.ts")), "the pane module is import-free");
});

if (failed > 0) {
  console.error(`\n${failed} mobile test(s) failed`);
  process.exit(1);
}
console.log("\nall mobile tests passed");
