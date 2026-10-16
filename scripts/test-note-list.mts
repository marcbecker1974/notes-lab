// Tests for the note list refinements (Feature 8.2). Run: npm run test:list
// Plain Node: compact preview, ordering and the saved sort choice. The dropdown and the
// 3-line clamp are checked in the browser; the clamp is also checked statically here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compactPreview } from "../lib/rich-text/preview.ts";
import {
  DEFAULT_NOTE_SORT,
  NOTE_SORT_STORAGE_KEY,
  filterNotes,
  loadNoteSort,
  orderNotes,
  saveNoteSort,
} from "../lib/notes-view.ts";
import type { Note } from "../lib/notes-db.ts";

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
const words = (text: string) => text.replace(/…$/, "").split(" ").filter(Boolean);
const note = (id: number, title: string, updatedAt: string, extra: Partial<Note> = {}): Note =>
  ({ id, title, body: "", collectionId: null, tagIds: [], createdAt: updatedAt, updatedAt, ...extra }) as Note;
const titles = (notes: Note[]) => notes.map((n) => n.title);

// --- preview
test("preview: at most 30 words, ellipsis when cut", () => {
  const body = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
  const out = compactPreview(body);
  assert.equal(words(out).length, 30);
  assert.ok(out.endsWith("…"));
  assert.equal(words(out)[29], "word29");
});
test("preview: exactly 30 words or fewer is unchanged, no ellipsis", () => {
  const thirty = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
  assert.equal(compactPreview(thirty), thirty);
  assert.equal(compactPreview("Short note."), "Short note.");
  assert.equal(compactPreview(""), "");
});
test("preview: never splits a word at the character cap", () => {
  const out = compactPreview("alpha ".repeat(150) + "omega");
  assert.ok(words(out).every((w) => w === "alpha"));
  const long = Array.from({ length: 40 }, () => "abcdefghijklmnopqrstuvwxyz").join(" ");
  assert.ok(words(compactPreview(long)).every((w) => w === "abcdefghijklmnopqrstuvwxyz"));
});
test("preview: a cut inside Markdown-heavy text never leaves a half word (review finding)", () => {
  const out = compactPreview("**abcdefghijklmnopqrstuvwxyz** ".repeat(25));
  assert.ok(out.endsWith("\u2026"));
  assert.ok(words(out).every((w) => w === "abcdefghijklmnopqrstuvwxyz"));
});
test("preview: text that was not cut keeps its last word; trailing punctuation goes before the ellipsis", () => {
  assert.equal(compactPreview("word ".repeat(100).trim()).endsWith("\u2026"), true);
  const noCut = Array.from({ length: 30 }, () => "abcdefghijklmnopqrstuvwxyz").join(" "); // 809 chars, 30 words, cut at 600
  assert.ok(compactPreview(noCut).endsWith("\u2026"));
  assert.equal(compactPreview(`${"a ".repeat(29)}b, c d`), `${"a ".repeat(29)}b\u2026`);
  assert.equal(compactPreview("x".repeat(900)).length, 600, "text without spaces: shortened by the cap and the CSS clamp only");
});
test("preview: Markdown cleanup and tables are preserved", () => {
  assert.equal(compactPreview("# T\n\n**b** <u>u</u> [l](https://a.b)\n- x"), "T b u l x");
  assert.equal(compactPreview("5 &lt; 6 \\* 2 snake\\_case"), "5 < 6 * 2 snake_case");
  const out = compactPreview("Intro prose\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter");
  assert.equal(out, "Intro prose After");
  assert.ok(!out.includes("|") && !out.includes("---"));
});
test("preview: card clamps to 3 lines (static)", () => {
  const card = readFileSync("components/notes/note-card.tsx", "utf8");
  assert.ok(card.includes("line-clamp-3") && !card.includes("line-clamp-2"));
  assert.ok(card.includes("compactPreview(note.body)"));
});
test("preview: no display utility overrides the clamp (regression: `block` after `line-clamp-3` showed every line)", () => {
  const card = readFileSync("components/notes/note-card.tsx", "utf8");
  const classes = /className="([^"]*line-clamp-3[^"]*)"/.exec(card)?.[1].split(/\s+/) ?? [];
  assert.ok(classes.includes("line-clamp-3"));
  const display = classes.filter((c) => /^(block|inline|inline-block|flex|inline-flex|grid|contents|table)$/.test(c));
  assert.deepEqual(display, [], "line-clamp sets display itself; a display class generated later wins and disables it");
});

// --- ordering
const same = "2026-01-01T00:00:00Z";
const chapters = ["07 G", "02 B", "00 A", "08 H", "04 D", "01 B2", "03 C", "06 F", "05 E"].map((t, i) => note(i + 1, t, same));
test("sort: numbered chapters 00 to 08 in order, natural numbers", () => {
  assert.deepEqual(titles(orderNotes(chapters, "title-asc")).map((t) => t.slice(0, 2)), ["00", "01", "02", "03", "04", "05", "06", "07", "08"]);
  const nat = ["Note 10", "Note 2", "Note 1"].map((t, i) => note(i, t, same));
  assert.deepEqual(titles(orderNotes(nat, "title-asc")), ["Note 1", "Note 2", "Note 10"]);
});
test("sort: title descending is the reverse", () => {
  assert.deepEqual(titles(orderNotes(chapters, "title-desc")).map((t) => t.slice(0, 2)), ["08", "07", "06", "05", "04", "03", "02", "01", "00"]);
});
test("sort: alphabetical, case-insensitive, stable on ties", () => {
  const list = [note(3, "banana", same), note(1, "Apple", same), note(2, "apple", same)];
  assert.deepEqual(orderNotes(list, "title-asc").map((n) => n.id), [1, 2, 3]);
});
test("sort: last modified newest and oldest first", () => {
  const list = [note(1, "a", "2026-01-02T00:00:00Z"), note(2, "b", "2026-03-01T00:00:00Z"), note(3, "c", "2026-02-01T00:00:00Z")];
  assert.deepEqual(orderNotes(list, "modified-desc").map((n) => n.id), [2, 3, 1]);
  assert.deepEqual(orderNotes(list, "modified-asc").map((n) => n.id), [1, 3, 2]);
});
test("sort: title descending keeps ties in ascending id order", () => {
  const list = [note(2, "same", same), note(1, "same", same), note(3, "z", same)];
  assert.deepEqual(orderNotes(list, "title-desc").map((n) => n.id), [3, 1, 2]);
});
test("sort: does not mutate its input", () => {
  const copy = [...chapters];
  orderNotes(chapters, "title-desc");
  assert.deepEqual(chapters, copy);
});

// --- combined with filtering and search
test("sort: works after view, tag and search filtering", () => {
  const all = [
    note(1, "10 Intro", same, { collectionId: 5, tagIds: [1], body: "gradient" }),
    note(2, "2 Intro", same, { collectionId: 5, tagIds: [1], body: "gradient" }),
    note(3, "Zeta", same, { collectionId: null, tagIds: [1, 2], body: "gradient" }),
    note(4, "Alpha", same, { collectionId: 5, tagIds: [2], body: "other" }),
  ];
  const sorted = (view: Parameters<typeof filterNotes>[1], tags: number[], q: string) =>
    titles(orderNotes(filterNotes(all, view, tags, q).notes, "title-asc"));
  assert.deepEqual(sorted({ kind: "all" }, [], ""), ["2 Intro", "10 Intro", "Alpha", "Zeta"]);
  assert.deepEqual(sorted({ kind: "collection", id: 5 }, [], ""), ["2 Intro", "10 Intro", "Alpha"]);
  assert.deepEqual(sorted({ kind: "uncollected" }, [], ""), ["Zeta"]);
  assert.deepEqual(sorted({ kind: "all" }, [1], ""), ["2 Intro", "10 Intro", "Zeta"]);
  assert.deepEqual(sorted({ kind: "all" }, [1, 2], ""), ["Zeta"]);
  assert.deepEqual(sorted({ kind: "all" }, [], "gradient"), ["2 Intro", "10 Intro", "Zeta"]);
  assert.deepEqual(sorted({ kind: "collection", id: 5 }, [1], "GRADIENT"), ["2 Intro", "10 Intro"]);
});

// --- persistence
const fakeStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
};
test("persistence: default is title ascending", () => {
  assert.equal(DEFAULT_NOTE_SORT, "title-asc");
  assert.equal(loadNoteSort(fakeStorage()), "title-asc");
  assert.equal(loadNoteSort(null), "title-asc");
});
test("persistence: a saved choice is restored", () => {
  const s = fakeStorage();
  for (const sort of ["title-desc", "modified-desc", "modified-asc", "title-asc"] as const) {
    saveNoteSort(s, sort);
    assert.equal(s.map.get(NOTE_SORT_STORAGE_KEY), sort);
    assert.equal(loadNoteSort(s), sort);
  }
});
test("persistence: invalid values and blocked storage fall back to the default", () => {
  const s = fakeStorage();
  s.map.set(NOTE_SORT_STORAGE_KEY, "nonsense");
  assert.equal(loadNoteSort(s), "title-asc");
  const broken = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  };
  assert.equal(loadNoteSort(broken), "title-asc");
  assert.doesNotThrow(() => saveNoteSort(broken, "title-desc"));
});

if (failed > 0) {
  console.error(`\n${failed} note-list test(s) failed`);
  process.exit(1);
}
console.log("\nall note-list tests passed");
