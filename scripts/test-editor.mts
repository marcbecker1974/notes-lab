// Tests for the rich-text editor's Markdown layer (Feature 8). Run: npm run test:editor
// Plain Node, no DOM and no database: conversion, the data-loss guard, link rules,
// export compatibility and static checks. Browser behaviour (toolbar clicks, source
// and fullscreen switching) is verified manually; see REFLECTION.md.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { JSONContent } from "@tiptap/react";
import {
  checkVisualSafety,
  hasFrontMatter,
  isAllowedLinkUri,
  normalizeLinkInput,
  parseMarkdown,
  serializeMarkdown,
  sourceModeNotice,
} from "../lib/rich-text/markdown.ts";
import { plainTextPreview, unescapeMarkdown } from "../lib/rich-text/preview.ts";
import { matchesQuery } from "../lib/notes-view.ts";
import { markdownFilename, noteToMarkdown, splitFrontMatter } from "../lib/note-markdown.ts";
import { copyText } from "../lib/rich-text/copy-text.ts";
import { changeMode, initialMode, modeNotice, restoreVisual } from "../lib/rich-text/editor-mode.ts";
import { buildPreview, codeBlockTexts, isPreviewLink, type Block, type Inline } from "../lib/rich-text/preview-model.ts";

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

const text = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const para = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const roundTrip = (md: string) => serializeMarkdown(parseMarkdown(md));

// --- Toolbar formatting -> Markdown (what each toolbar command produces) -------------
test("paragraph and headings 1 to 3", () => {
  const heading = (level: number, value: string): JSONContent => ({
    type: "heading",
    attrs: { level },
    content: [text(value)],
  });
  assert.equal(
    serializeMarkdown(doc(heading(1, "One"), heading(2, "Two"), heading(3, "Three"), para(text("Body")))),
    "# One\n\n## Two\n\n### Three\n\nBody",
  );
});
test("bold, italic and underline", () => {
  assert.equal(serializeMarkdown(doc(para(text("a", "bold")))), "**a**");
  assert.equal(serializeMarkdown(doc(para(text("a", "italic")))), "*a*");
  assert.equal(serializeMarkdown(doc(para(text("a", "underline")))), "<u>a</u>");
});
test("underline is written as <u>, never as ++", () => {
  assert.ok(!serializeMarkdown(doc(para(text("a", "underline")))).includes("++"));
});
test("links", () => {
  const link: JSONContent = {
    type: "text",
    text: "Example",
    marks: [{ type: "link", attrs: { href: "https://example.com" } }],
  };
  assert.equal(serializeMarkdown(doc(para(link))), "[Example](https://example.com)");
});
test("bulleted and numbered lists", () => {
  const item = (value: string): JSONContent => ({ type: "listItem", content: [para(text(value))] });
  assert.equal(
    serializeMarkdown(doc({ type: "bulletList", content: [item("a"), item("b")] })),
    "- a\n- b",
  );
  assert.equal(
    serializeMarkdown(doc({ type: "orderedList", attrs: { start: 1 }, content: [item("a"), item("b")] })),
    "1. a\n2. b",
  );
});

// --- Markdown round trips ------------------------------------------------------------
const stable: [string, string][] = [
  ["paragraphs", "First.\n\nSecond."],
  ["line breaks inside a paragraph", "one\ntwo\nthree"],
  ["hard break", "a  \nb"],
  ["headings", "# H1\n\n## H2\n\n### H3"],
  ["bold, italic, both", "**b** and *i* and ***both***"],
  ["underline", "text <u>under</u> text"],
  ["links", "[Example](https://example.com)"],
  ["bulleted list, nested", "- a\n- b\n  - nested\n- c"],
  ["numbered list", "1. one\n2. two\n3. three"],
  ["code fence with language and blank line", "```ts\nconst a = 1;\n\n  indented();\n```"],
  ["inline code", "use `npm i` now"],
  ["blockquote", "> quoted\n> line two"],
  ["strikethrough", "~~gone~~"],
  ["horizontal rule", "above\n\n---\n\nbelow"],
  ["Unicode", "Grüße 日本語 😀 – “quotes” é"],
  ["empty body", ""],
];
for (const [name, md] of stable) test(`round trip keeps ${name}`, () => assert.equal(roundTrip(md), md));

test("round trip is stable when repeated", () => {
  for (const [, md] of stable) assert.equal(roundTrip(roundTrip(md)), roundTrip(md));
});
test("the serializer's trailing newlines are removed", () => {
  assert.equal(roundTrip("# Title"), "# Title");
  assert.equal(roundTrip("- a\n- b"), "- a\n- b");
  assert.equal(roundTrip("```\ncode\n```"), "```\ncode\n```");
});

// --- Underline combinations (regression: spike bug, inner Markdown stayed literal) ----
const marksOf = (md: string) => {
  const found: string[][] = [];
  const visit = (node: JSONContent) => {
    if (node.type === "text") found.push((node.marks ?? []).map((m) => m.type).sort());
    (node.content ?? []).forEach(visit);
  };
  visit(parseMarkdown(md));
  return found;
};
test("bold inside underline is parsed as bold, not literal asterisks", () => {
  assert.deepEqual(marksOf("<u>**x**</u>"), [["bold", "underline"]]);
  assert.ok(!roundTrip("<u>**x**</u>").includes("\\*"));
});
test("italic inside underline keeps both marks (spike bug)", () => {
  assert.deepEqual(marksOf("<u>*x* y</u>"), [["italic", "underline"], ["underline"]]);
  assert.ok(!roundTrip("<u>*x* y</u>").includes("\\*"));
});
test("underline around a link, and bold or italic around underline", () => {
  assert.deepEqual(marksOf("<u>a [l](https://a.b) b</u>"), [["underline"], ["link", "underline"], ["underline"]]);
  assert.deepEqual(marksOf("**<u>x</u>**"), [["bold", "underline"]]);
  assert.deepEqual(marksOf("*<u>x</u>*"), [["italic", "underline"]]);
});
test("underline, bold and italic together survive save and reload", () => {
  const once = serializeMarkdown(
    doc(para(text("x", "underline", "bold", "italic"), text(" plain"))),
  );
  assert.deepEqual(marksOf(once), [["bold", "italic", "underline"], []]);
  assert.equal(roundTrip(once), once);
});

// --- Existing plain-text notes ---------------------------------------------------------
test("plain text keeps its words and its line breaks", () => {
  const plain = "Meeting notes\nline two\n\nSecond paragraph, 100% done.";
  assert.equal(roundTrip(plain), plain);
  assert.deepEqual(checkVisualSafety(plain), { safe: true });
});

// --- The data-loss guard -------------------------------------------------------------
const lossy: [string, string, string][] = [
  ["a table", "| a | b |\n|---|---|\n| 1 | 2 |", "tables"],
  ["an image", "![alt](https://x.y/z.png)", "images"],
  ["a task list", "- [ ] todo\n- [x] done", "task lists"],
  ["a footnote", "text[^1]\n\n[^1]: note", "footnotes"],
  ["an HTML block", '<div class="x">raw</div>', "HTML"],
  ["a script tag", "hi <script>alert(1)</script>", "HTML"],
  ["an iframe", '<iframe src="//evil"></iframe>text', "HTML"],
  ["an HTML tag in prose (generics)", "use List<string> here", "HTML"],
  ["an unclosed underline tag", "<u>unclosed", "HTML"],
];
for (const [name, md, reason] of lossy) {
  test(`guard sends ${name} to source mode`, () => {
    const result = checkVisualSafety(md);
    assert.equal(result.safe, false);
    if (!result.safe) assert.ok(result.reasons.includes(reason), result.reasons.join());
  });
}
test("guard keeps the original Markdown untouched (it never rewrites)", () => {
  const original = "| a |\n|---|\n| 1 |";
  checkVisualSafety(original);
  assert.equal(original, "| a |\n|---|\n| 1 |");
});
test("guard allows everything the toolbar can produce", () => {
  const rich =
    "# T\n\n**b** *i* <u>u</u> [l](https://a.b)\n\n- a\n- b\n\n1. c\n\n> q\n\n```js\nlet a = 1 < 2;\n```\n\n---\n\n~~s~~ `code`";
  assert.deepEqual(checkVisualSafety(rich), { safe: true });
});
test("guard is not fooled by tables, images or HTML inside code", () => {
  const code = "```\n| a |\n|---|\n![x](y)\n<div>\n```\n\nand `<b>` inline";
  assert.deepEqual(checkVisualSafety(code), { safe: true });
});
test("comparison and unsupported-structure checks both feed the guard", () => {
  // Words disappear in the conversion although no structure matched.
  const result = checkVisualSafety("a<b>c</b>d");
  assert.equal(result.safe, false);
});

// --- Links ---------------------------------------------------------------------------
for (const ok of ["https://example.com", "http://a.b/c?d=1#e", "mailto:a@b.co", "example.com", "a@b.co"]) {
  test(`link input accepts ${ok}`, () => assert.ok(normalizeLinkInput(ok) !== null));
}
test("bare addresses get a protocol", () => {
  assert.equal(normalizeLinkInput("example.com"), "https://example.com");
  assert.equal(normalizeLinkInput("a@b.co"), "mailto:a@b.co");
  assert.equal(normalizeLinkInput("  https://x.y  "), "https://x.y");
});
for (const bad of [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "java\tscript:alert(1)",
  " javascript:alert(1)",
  "data:text/html;base64,AAAA",
  "file:///etc/passwd",
  "tel:+491234",
  "ftp://example.com",
  "vbscript:x",
  "https://exa mple.com",
  "",
  "   ",
]) {
  test(`link input rejects ${JSON.stringify(bad)}`, () => assert.equal(normalizeLinkInput(bad), null));
}
test("stored or pasted links: relative links pass, unsafe protocols do not", () => {
  assert.ok(isAllowedLinkUri("https://a.b"));
  assert.ok(isAllowedLinkUri("mailto:a@b.co"));
  assert.ok(isAllowedLinkUri("/notes"));
  assert.ok(isAllowedLinkUri("#top"));
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///x", "tel:1", "ftp://x", undefined, ""]) {
    assert.equal(isAllowedLinkUri(bad), false, String(bad));
  }
});

// --- Security: hostile content never becomes HTML -------------------------------------
test("hostile HTML is dropped by the conversion, never kept as markup", () => {
  for (const hostile of [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '<a href="https://x" onclick="evil()">a</a>',
    '<iframe src="//evil"></iframe>',
    "<style>body{display:none}</style>",
  ]) {
    const out = roundTrip(hostile);
    assert.ok(!/<(script|img|iframe|style|a)\b/i.test(out), `${hostile} -> ${out}`);
    assert.equal(checkVisualSafety(hostile).safe, false);
  }
});

// --- The 20,000-character limit counts the Markdown that is saved ---------------------
const limit = Number(/NOTE_BODY_MAX = (\d+)/.exec(readFileSync("lib/notes-db.ts", "utf8"))?.[1]);
test("the body limit is 20,000 characters", () => assert.equal(limit, 20000));
test("ordinary prose is not expanded by a round trip", () => {
  const prose = ("Para **bold** text with [link](https://x.y) and more words here.\n\n").repeat(250).trim();
  assert.ok(Array.from(roundTrip(prose)).length <= Array.from(prose).length);
});
test("text full of special characters can grow past the limit, which the saved Markdown reveals", () => {
  const special = "a_b*c[d]#e".repeat(1900); // 19,000 characters as typed
  const saved = roundTrip(special);
  assert.ok(Array.from(special).length <= limit);
  assert.ok(Array.from(saved).length > limit, "expected escaping to expand the text");
});

// --- Feature 9 compatibility ----------------------------------------------------------
test("export keeps editor output as Markdown, with <u> for underline", () => {
  const body = serializeMarkdown(
    doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Part")] },
      para(text("a", "bold"), text(" "), text("b", "underline")),
    ),
  );
  assert.equal(noteToMarkdown({ title: "T", body }), "# T\n\n## Part\n\n**a** <u>b</u>\n");
});
test("export of a formatted note round-trips through the editor unchanged", () => {
  const body = "## H\n\n**b** *i* <u>u</u> [l](https://a.b)\n\n- a\n\n1. b\n\n> q";
  assert.equal(roundTrip(noteToMarkdown({ title: "T", body }).replace(/^# T\n\n/, "").trimEnd()), body);
});
test("export file names stay safe", () => {
  assert.equal(markdownFilename('a/b:c*"d'), "a-b-c--d.md");
});

// --- YAML front matter (independent PR review, 2026-10-15) ----------------------------
const FM_ONE = "---\ntitle: Weekly notes\n---\n\nBody text about kubernetes.";
const FM_MANY =
  "---\ntitle: \"Plan: Q4\"\ndate: 2026-10-15\ntags:\n  - ai\n  - journal\n# a comment\ndraft: false\n---\n## Heading\n\n- item";
test("valid YAML front matter is detected and sends the note to source mode", () => {
  for (const md of [FM_ONE, FM_MANY, FM_ONE.replace(/\n/g, "\r\n"), "\uFEFF" + FM_ONE, "---\ntitle: x\n...\ntext", "---\ntitle: x\n---"]) {
    assert.ok(hasFrontMatter(md), JSON.stringify(md));
    const result = checkVisualSafety(md);
    assert.equal(result.safe, false);
    if (!result.safe) assert.ok(result.reasons.includes("YAML front matter"));
  }
});
test("the unprotected conversion really would change front matter (why the guard exists)", () => {
  assert.notEqual(roundTrip(FM_ONE), FM_ONE);
});
test("ordinary horizontal rules are not front matter", () => {
  for (const md of ["---\n\nparagraph", "text\n\n---\n\nmore", "---\nsome prose line\n---\nafter", "---\n---", "a\n---\nb: c\n---", "***\ntitle: x\n***", "----\ntitle: x\n----"]) {
    assert.equal(hasFrontMatter(md), false, JSON.stringify(md));
  }
  assert.deepEqual(checkVisualSafety("# T\n\ntext\n\n---\n\nmore"), { safe: true });
  assert.deepEqual(checkVisualSafety("---\n\nparagraph"), { safe: true });
});
test("a front matter marker later in the note is not front matter", () => {
  assert.equal(hasFrontMatter("intro\n\n---\ntitle: x\n---\n"), false);
});
test("opening, checking and cancelling never change the stored Markdown", () => {
  const stored = FM_MANY;
  const copy = `${stored}`;
  checkVisualSafety(stored);
  assert.equal(stored, copy);
  // The editor never opens an unsafe note in the visual editor (it opens in the read-only Preview, Feature 8.1),
  // and only reports user edits.
  const component = read("components/notes/rich-text-editor.tsx");
  assert.ok(component.includes("initialMode(initial)"));
  assert.equal(initialMode(checkVisualSafety(stored)), "preview");
  assert.ok(component.includes("!transaction.docChanged"));
  assert.ok(component.includes("emitUpdate: false"));
  // Switching to visual is refused while the guard says unsafe (the rule lives in changeMode, used by the editor).
  assert.ok(component.includes("changeMode(target, mode, blocked, value)"));
  const modes = read("lib/rich-text/editor-mode.ts");
  assert.ok(/const check = checkVisualSafety\(value\);\s+if \(!check\.safe\) return \{ mode: current/.test(modes));
  assert.equal(changeMode("visual", "preview", null, stored).loadVisual, false);
});
test("removing the front matter in source mode makes the note safe for visual mode again", () => {
  assert.equal(checkVisualSafety(FM_ONE.replace(/^---\n.*\n---\n\n/, "")).safe, true);
});
test("search finds front matter keys, values and body", () => {
  const note = { title: "T", body: FM_MANY } as Parameters<typeof matchesQuery>[0];
  for (const q of ["date: 2026-10-15", "journal", "Q4", "item", "draft"]) assert.ok(matchesQuery(note, q), q);
  assert.ok(!matchesQuery(note, "absent"));
});
// --- Export with front matter (owner manual test N, 2026-10-15) -----------------------
const META = '---\ntitle: AI Playbook\nversion: "2.1"\nstatus: active\n---';
const REST = "# Operating Standard\n\nText with <u>u</u> and **b**.\n\n- a\n- b";
test("export puts the front matter first, then the title heading, then the rest", () => {
  const out = noteToMarkdown({ title: "Note Title", body: `${META}\n\n${REST}` });
  assert.equal(out, `${META}\n\n# Note Title\n\n${REST}\n`);
  assert.ok(out.startsWith("---\ntitle: AI Playbook\n"));
  assert.ok(out.indexOf("# Note Title") > out.indexOf("status: active\n---"));
});
test("export keeps every metadata line and the body unchanged (several fields, lists, comments)", () => {
  const front = "---\ntitle: \"Plan: Q4\"\ntags:\n  - ai\n  - journal\n# note\ndraft: false\n---";
  const out = noteToMarkdown({ title: "T", body: `${front}\nBody *here*` });
  assert.equal(out, `${front}\n\n# T\n\nBody *here*\n`);
});
test("export with front matter and an empty body keeps just the block and the title", () => {
  assert.equal(noteToMarkdown({ title: "T", body: META }), `${META}\n\n# T\n`);
  assert.equal(noteToMarkdown({ title: "T", body: `${META}\n\n\n` }), `${META}\n\n# T\n`);
});
test("export with front matter: CRLF becomes LF, a BOM is dropped, Unicode survives", () => {
  const out = noteToMarkdown({ title: "Größe 日本語", body: "\uFEFF---\r\ntitle: Ünï 🚀\r\n---\r\nzweite Zeile\r\n" });
  assert.equal(out, "---\ntitle: Ünï 🚀\n---\n\n# Größe 日本語\n\nzweite Zeile\n");
});
test("export of ordinary notes is unchanged (no front matter)", () => {
  assert.equal(noteToMarkdown({ title: "T", body: "plain" }), "# T\n\nplain\n");
  assert.equal(noteToMarkdown({ title: "T", body: "" }), "# T\n");
  for (const body of ["---\n\nparagraph", "text\n\n---\n\nmore", "---\nsome prose line\n---\nafter", "***\ntitle: x\n***", "intro\n\n---\ntitle: x\n---"]) {
    assert.equal(noteToMarkdown({ title: "T", body }), `# T\n\n${body}\n`, JSON.stringify(body));
  }
});
test("empty or malformed front matter is not rewritten", () => {
  for (const body of ["---\n---\ntext", "---\ntitle: x\ntext", "---\n\n---\ntext", "---\nnot yaml here\n---\ntext", "---\n- only\n- items\n---\ntext"]) {
    assert.equal(noteToMarkdown({ title: "T", body }), `# T\n\n${body}\n`, JSON.stringify(body));
  }
});
test("export of front matter notes is idempotent in content and does not change the stored text", () => {
  const body = `${META}\n\n${REST}`;
  const copy = `${body}`;
  noteToMarkdown({ title: "T", body });
  assert.equal(body, copy);
  // The body of the exported file still starts the same front matter block.
  assert.ok(hasFrontMatter(noteToMarkdown({ title: "T", body })));
});
// --- Front matter detection is linear (independent PR #10 review, ReDoS) -----------------
// The earlier single regex backtracked exponentially when the closing line was missing
// (16 unclosed `k: v` lines took more than 10 s). The pathological inputs run in a
// separate process with an enforced timeout, so a regression cannot hang the test run.
type Probe = {
  ms: number;
  detected: boolean;
  safe: boolean;
  frontLines: number;
  restStart: string | null;
  exportStartsWithRule: boolean;
  exportEndsWithTitleAndBody: boolean;
  exportTitleOnly: boolean;
};
function probe(mode: "new" | "old", name: string, n: number, timeoutMs: number) {
  const run = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/front-matter-probe.mts", mode, name, String(n)],
    { encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL" },
  );
  const killed = run.error !== undefined || run.signal !== null;
  return { killed, result: killed ? null : (JSON.parse(run.stdout.trim().split("\n").pop() ?? "{}") as Probe) };
}
const PROBE_TIMEOUT = 20_000;
const fast = (name: string, n: number) => {
  const { killed, result } = probe("new", name, n, PROBE_TIMEOUT);
  assert.ok(!killed && result, `${name} ${n} did not finish in ${PROBE_TIMEOUT} ms`);
  assert.ok(result.ms < 2000, `${name} ${n} took ${Math.round(result.ms)} ms`);
  return result;
};
test("control: the old regex really hangs on the demonstrated input (killed by the timeout)", () => {
  assert.equal(probe("old", "unclosed", 24, 2000).killed, true);
});
test("unclosed or malformed blocks of thousands of lines finish promptly and are not front matter", () => {
  for (const [name, n] of [["unclosed", 16], ["unclosed", 5000], ["unclosedCrlf", 5000], ["longLine", 200000], ["longKeyLine", 200000], ["malformed", 5000]] as const) {
    const r = fast(name, n);
    assert.equal(r.detected, false, `${name} ${n}`);
    assert.equal(r.frontLines, 0);
    assert.equal(r.exportStartsWithRule, false);
    assert.equal(r.exportTitleOnly, true);
  }
});
test("detection time does not grow exponentially with the unclosed block", () => {
  const times = [1000, 2000, 4000, 8000, 16000].map((n) => fast("unclosed", n).ms);
  // 16x the lines must stay near-linear, nowhere near the exponential cost (each also under 2 s).
  assert.ok(times[4] < Math.max(times[0], 5) * 200, JSON.stringify(times));
});
test("large valid front matter (LF, and CRLF with a BOM, closed by --- or ...) is detected and exported first", () => {
  for (const name of ["validLf", "validCrlfBom"]) {
    const r = fast(name, 5000);
    assert.equal(r.detected, true, name);
    assert.equal(r.safe, false, name);
    assert.equal(r.frontLines, 5003, name);
    assert.equal(r.restStart, "body", name);
    assert.equal(r.exportStartsWithRule, true, name);
    assert.equal(r.exportEndsWithTitleAndBody, true, name);
  }
});
test("thousands of horizontal rules are not front matter and stay safe for the visual editor", () => {
  for (const name of ["rules", "manyRules"]) {
    const r = fast(name, 5000);
    assert.equal(r.detected, false, name);
    assert.equal(r.exportStartsWithRule, false, name); // not front matter: the title heading comes first
    assert.equal(r.exportTitleOnly, true, name);
  }
});
test("scanner: delimiters, line endings, BOM and the key requirement", () => {
  const split = (body: string) => splitFrontMatter(body);
  assert.deepEqual(split("---\na: 1\n---\nrest"), { front: "---\na: 1\n---\n", rest: "rest" });
  assert.deepEqual(split("---\na: 1\n...\nrest"), { front: "---\na: 1\n...\n", rest: "rest" });
  assert.deepEqual(split("---\r\na: 1\r\n---\r\nrest"), { front: "---\r\na: 1\r\n---\r\n", rest: "rest" });
  assert.deepEqual(split("﻿---\na: 1\n---"), { front: "---\na: 1\n---", rest: "" });
  assert.deepEqual(split("--- \na: 1\n ---  \nrest"), { front: "--- \na: 1\n ---  \n", rest: "rest" });
  assert.deepEqual(split("---\na: 1\n\n  b: 2\n# c\n- d\n---\nx"), { front: "---\na: 1\n\n  b: 2\n# c\n- d\n---\n", rest: "x" });
  // The first closing line ends the block.
  assert.deepEqual(split("---\na: 1\n---\nb: 2\n---\n"), { front: "---\na: 1\n---\n", rest: "b: 2\n---\n" });
  for (const bad of ["", "---", "---\n", "---\na: 1", "---\n---", "---\n- x\n---", "---\n# c\n---", "---\nprose\n---", "x\n---\na: 1\n---", " ---\na: 1\n---", "----\na: 1\n----", "---x\na: 1\n---"]) {
    assert.equal(split(bad), null, JSON.stringify(bad));
  }
});
test("export works on the saved note only, never on the editor draft", () => {
  const app = read("components/notes/notes-app.tsx");
  assert.ok(app.includes("onExport={() => selectedNote && downloadNoteAsMarkdown(selectedNote)}"));
  assert.ok(!/downloadNoteAsMarkdown\([^)]*draft/i.test(app));
  assert.ok(!/noteToMarkdown|downloadNoteAsMarkdown/.test(read("components/notes/rich-text-editor.tsx")));
  assert.ok(!/noteToMarkdown|downloadNoteAsMarkdown/.test(read("components/notes/note-editor.tsx")));
});
test("export file name safety is unchanged by front matter notes", () => {
  assert.equal(markdownFilename('a/b:c*"d'), "a-b-c--d.md");
});

// --- Card preview (display only) -------------------------------------------------------
test("list preview hides Markdown marks", () => {
  assert.equal(plainTextPreview("# T\n\n**b** <u>u</u> [l](https://a.b)\n- x"), "T b u l x");
});

// --- Review findings (code review, 2026-10-15) ---------------------------------------
test("bare URLs and e-mail addresses open visually (the serializer writes them as [x](x))", () => {
  assert.deepEqual(checkVisualSafety("see https://example.com now"), { safe: true });
  assert.deepEqual(checkVisualSafety("mail foo@bar.com today"), { safe: true });
  assert.deepEqual(checkVisualSafety("<https://example.com>"), { safe: true });
});
test("a link the saved text would no longer read back as a link goes to source mode", () => {
  const result = checkVisualSafety("[a](<b c>)");
  assert.equal(result.safe, false);
  if (!result.safe) assert.ok(result.reasons.includes("link targets"));
});
test("a numeric character reference opens in source mode instead of being replaced", () => {
  assert.equal(checkVisualSafety("&#169; 2026 ACME").safe, false);
});
test("unescaping undoes what the editor writes", () => {
  assert.equal(unescapeMarkdown("snake\\_case 2 \\* 3 5 &lt; 6 &amp;amp; C:\\\\Users"), "snake_case 2 * 3 5 < 6 &amp; C:\\Users");
});
test("search finds text the editor stored escaped, and still finds raw Markdown", () => {
  const note = { title: "T", body: "use snake\\_case and 5 &lt; 6 [docs](https://x.y)" } as Parameters<typeof matchesQuery>[0];
  assert.ok(matchesQuery(note, "snake_case"));
  assert.ok(matchesQuery(note, "5 < 6"));
  assert.ok(matchesQuery(note, "https://x.y"));
  assert.ok(!matchesQuery(note, "nothing here"));
});
test("preview shows readable text: escapes undone, lone asterisks and numbers kept", () => {
  assert.equal(plainTextPreview("5 &lt; 6 \\* 2 snake\\_case"), "5 < 6 * 2 snake_case");
  assert.equal(plainTextPreview("2 * 3 = 6"), "2 * 3 = 6");
  assert.equal(plainTextPreview("1986. A good year"), "1986. A good year");
  assert.equal(plainTextPreview("[w](https://en.wikipedia.org/wiki/Foo_(bar)) next"), "w next");
  assert.equal(plainTextPreview("x".repeat(5000)).length, 600);
});
test("the editor layer imports only approved Tiptap packages", () => {
  const approved = /^@tiptap\/(react|pm|starter-kit|markdown|extension-underline)($|\/)/;
  for (const file of ["lib/rich-text/markdown.ts", "components/notes/rich-text-editor.tsx", "components/notes/editor-toolbar.tsx", "components/notes/markdown-preview.tsx", "lib/rich-text/preview-model.ts", "lib/rich-text/editor-mode.ts", "scripts/test-editor.mts"]) {
    for (const m of read(file).matchAll(/from "(@tiptap\/[^"]+)"/g)) assert.ok(approved.test(m[1]), `${file}: ${m[1]}`);
  }
});

// --- Static checks ----------------------------------------------------------------------
const editorFiles = ["components/notes/rich-text-editor.tsx", "components/notes/editor-toolbar.tsx", "components/notes/markdown-preview.tsx"];
test("editor files exist", () => editorFiles.forEach((f) => assert.ok(existsSync(f), f)));
test("no unsafe HTML rendering, no database or Supabase access in the editor layer", () => {
  const files = [...editorFiles, "lib/rich-text/markdown.ts", "lib/rich-text/preview.ts", "lib/rich-text/preview-model.ts", "lib/rich-text/editor-mode.ts", "lib/rich-text/copy-text.ts"];
  for (const file of files) {
    const source = read(file);
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML/.test(source), `${file}: unsafe HTML`);
    assert.ok(!/supabase|notes-db|\.from\(|\.rpc\(/.test(source), `${file}: database access`);
  }
});
test("the editor never calls Save or Cancel itself (mode and fullscreen switches are not edits)", () => {
  for (const file of editorFiles) assert.ok(!/onSave|onCancel|onDelete/.test(read(file)), file);
});
test("the editor only reports changes made by the user", () => {
  const source = read("components/notes/rich-text-editor.tsx");
  assert.ok(/emitUpdate:\s*false/.test(source), "external content must not be reported as an edit");
  assert.ok(/transaction\.docChanged|docChanged/.test(source));
});
test("fullscreen uses CSS only, not the browser Fullscreen API", () => {
  const source = read("components/notes/rich-text-editor.tsx");
  assert.ok(!/requestFullscreen|exitFullscreen/.test(source));
  assert.ok(/fixed inset-0/.test(source));
});
test("no migration, policy or grant was added for Feature 8", () => {
  const names = readdirSync("supabase/migrations");
  assert.ok(!names.some((n) => /rich|editor|markdown/i.test(n)), names.join());
});

// --- Markdown Preview (Feature 8.1) -------------------------------------------------------
// A note shaped like the imported Playbook notes (synthetic): a table with an escaped pipe, nested
// lists, and a prompt in a fenced block with indentation, blank lines, angle brackets and quotes.
const PROMPT = ['First line', '  indented line', '', 'after blank <tag> & "quotes"', '    deeper'].join("\n");
const PLAYBOOK_LIKE = [
  "## A. Overview",
  "",
  "| Step | Task | Notes |",
  "|:--|---|--:|",
  "| 00.01 | Scope and `code` | long text " + "word ".repeat(80).trim() + " |",
  "| 00.02 | Escaped \\| pipe | **bold** |",
  "",
  "### Prompts",
  "",
  "- first",
  "- second",
  "  1. nested one",
  "  2. nested two",
  "",
  "```text",
  PROMPT,
  "```",
  "",
].join("\n");
const ORDINARY = "Just **bold** text\n\n- a\n- b";

const kinds = (tree: Block[]) => tree.map((b) => b.kind);
const plain = (inl: Inline[]): string => inl.map((i) => (i.kind === "text" || i.kind === "code" ? i.text : i.kind === "br" ? "\n" : plain(i.children))).join("");
const asBlock = <K extends Block["kind"]>(tree: Block[], kind: K) => tree.find((b) => b.kind === kind) as Extract<Block, { kind: K }>;

test("preview: headings, paragraphs and inline formatting", () => {
  const tree = buildPreview("# One\n## Two\n### Three\n\nText **bold** *italic* <u>under</u> ~~gone~~ `code` [site](https://example.com).");
  assert.deepEqual(kinds(tree), ["heading", "heading", "heading", "paragraph"]);
  assert.deepEqual(tree.slice(0, 3).map((b) => (b.kind === "heading" ? b.level : 0)), [1, 2, 3]);
  const p = asBlock(tree, "paragraph");
  assert.deepEqual(p.children.map((i) => i.kind).filter((k) => k !== "text"), ["strong", "em", "u", "del", "code", "link"]);
  const link = p.children.find((i) => i.kind === "link");
  assert.ok(link && link.kind === "link" && link.href === "https://example.com");
});
test("preview: bullet, numbered, nested and task lists", () => {
  const tree = buildPreview("- a\n- b\n  1. x\n  2. y\n\n3. three\n4. four\n\n- [x] done\n- [ ] todo");
  const lists = tree.filter((b) => b.kind === "list") as Extract<Block, { kind: "list" }>[];
  assert.equal(lists.length, 3);
  assert.equal(lists[0].ordered, false);
  assert.equal(lists[0].items.length, 2);
  const nested = lists[0].items[1].blocks.find((b) => b.kind === "list") as Extract<Block, { kind: "list" }>;
  assert.ok(nested && nested.ordered && nested.items.length === 2, "the nested numbered list is kept");
  assert.equal(lists[1].ordered, true);
  assert.equal(lists[1].start, 3, "a numbered list keeps its start number");
  assert.deepEqual(lists[2].items.map((i) => [i.task, i.checked]), [[true, true], [true, false]]);
});
test("preview: blockquote and horizontal rule", () => {
  const tree = buildPreview("> quoted *text*\n\n---\n\nafter");
  assert.deepEqual(kinds(tree), ["quote", "hr", "paragraph"]);
});

test("preview tables: header, alignment, all rows and columns, escaped pipes, long cells", () => {
  const table = asBlock(buildPreview(PLAYBOOK_LIKE), "table");
  assert.deepEqual(table.header.map(plain), ["Step", "Task", "Notes"]);
  assert.deepEqual(table.align, ["left", null, "right"]);
  assert.equal(table.rows.length, 2);
  assert.ok(table.rows.every((r) => r.length === 3), "every row keeps all columns");
  assert.equal(plain(table.rows[1][1]), "Escaped | pipe", "an escaped pipe stays inside its cell");
  assert.equal(plain(table.rows[0][2]), "long text " + "word ".repeat(80).trim(), "a long cell is kept in full");
  assert.ok(table.rows[0][1].some((i) => i.kind === "code"));
  assert.ok(table.rows[1][2].some((i) => i.kind === "strong"));
  const wide = ["|" + Array.from({ length: 14 }, (_, i) => ` H${i} `).join("|") + "|", "|" + "---|".repeat(14), "|" + Array.from({ length: 14 }, (_, i) => ` c${i} `).join("|") + "|"].join("\n");
  const w = asBlock(buildPreview(wide), "table");
  assert.deepEqual([w.header.length, w.rows.length, w.rows[0].length], [14, 1, 14], "a wide table keeps every column (the view scrolls sideways)");
});
test("preview tables: several tables and tables between other content", () => {
  const tree = buildPreview("Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nMiddle\n\n| c |\n|---|\n| 3 |\n\nEnd");
  assert.deepEqual(kinds(tree), ["paragraph", "table", "paragraph", "table", "paragraph"]);
});

test("preview code blocks: the text is exactly the original, with its language", () => {
  const tree = buildPreview(PLAYBOOK_LIKE);
  const code = asBlock(tree, "code");
  assert.equal(code.lang, "text");
  assert.equal(code.text, PROMPT, "indentation, blank lines, brackets and quotes are preserved");
  assert.deepEqual(codeBlockTexts(tree), [PROMPT]);
  const two = buildPreview("```\none\n```\n\ntext\n\n````md\n```inner```\n````\n");
  assert.deepEqual(codeBlockTexts(two), ["one", "```inner```"], "several blocks, and a longer outer fence keeps an inner one");
  const inList = buildPreview("- item\n\n  ```sh\n  echo hi\n  ```\n");
  assert.deepEqual(codeBlockTexts(inList), ["echo hi"]);
});

test("preview safety: raw HTML is text, images are alt text, only http, https and mailto become links", () => {
  const tree = buildPreview("<script>alert(1)</script>\n\nText <b onclick=\"x()\">hi</b> ![pic](http://x/y.png) [a](javascript:alert(1)) [b](data:text/html,x) [c](relative/page) [d](mailto:a@b.co) [e](http://ok.example)");
  const json = JSON.stringify(tree);
  assert.ok(!/"kind":"(script|img|html-element)"/.test(json));
  assert.equal(asBlock(tree, "html").text, "<script>alert(1)</script>", "a raw HTML block is shown as its own text");
  const p = asBlock(tree, "paragraph");
  assert.ok(plain(p.children).includes('<b onclick="x()">hi</b>'), "inline HTML is shown as text");
  assert.ok(plain(p.children).includes("pic"), "an image is shown as its alt text");
  const hrefs = p.children.flatMap((i) => (i.kind === "link" ? [i.href] : []));
  assert.deepEqual(hrefs, ["mailto:a@b.co", "http://ok.example"]);
  for (const text of ["a", "b", "c"]) assert.ok(plain(p.children).includes(text), `the text of the refused link ${text} stays visible`);
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:x", "data:text/html,x", "file:///etc/passwd", "ftp://x", "tel:123", "relative/page", "#top", "", undefined]) assert.equal(isPreviewLink(bad as string | undefined), false, String(bad));
  for (const ok of ["https://a.example", "http://a.example", "mailto:a@b.co"]) assert.equal(isPreviewLink(ok), true, ok);
});
test("preview: empty and unusual input never throws", () => {
  assert.deepEqual(buildPreview(""), []);
  for (const s of ["\n\n\n", "|", "| a |", "```", "- ", "> ", "#", "\u0000​", "x".repeat(20000), "[".repeat(2000), "*".repeat(2000)]) {
    assert.doesNotThrow(() => buildPreview(s), s.slice(0, 12));
  }
  assert.ok(buildPreview("```\nunclosed fence\nstill code").some((b) => b.kind === "code"));
});

test("copy: the exact text is written, failures and a missing clipboard are reported, nothing else happens", async () => {
  const written: string[] = [];
  const ok = await copyText(PROMPT, { writeText: async (s) => void written.push(s) });
  assert.equal(ok, true);
  assert.deepEqual(written, [PROMPT], "complete text, byte for byte");
  assert.equal(await copyText(PROMPT, { writeText: async () => { throw new Error("denied"); } }), false);
  assert.equal(await copyText(PROMPT, undefined), false);
  const fromTree = codeBlockTexts(buildPreview(PLAYBOOK_LIKE))[0];
  const w2: string[] = [];
  await copyText(fromTree, { writeText: async (s) => void w2.push(s) });
  assert.equal(w2[0], PROMPT, "what the button copies is the original prompt");
});

test("modes: ordinary notes keep the visual editor, notes the guard blocks open in Preview", () => {
  assert.equal(initialMode(checkVisualSafety(ORDINARY)), "visual");
  assert.equal(initialMode(checkVisualSafety(PLAYBOOK_LIKE)), "preview");
  assert.equal(initialMode(checkVisualSafety("")), "visual");
  for (const unsafe of ["| a |\n|---|\n| 1 |", "![i](http://x/y.png)", "- [ ] task", "<div>x</div>", "---\ntitle: x\n---\n\nbody"]) {
    assert.equal(initialMode(checkVisualSafety(unsafe)), "preview", unsafe.slice(0, 20));
  }
});
test("modes: the guard still refuses the visual editor for unsafe content, in every mode", () => {
  for (const current of ["preview", "source"] as const) {
    const refused = changeMode("visual", current, null, PLAYBOOK_LIKE);
    assert.equal(refused.mode, current, "the mode does not change");
    assert.equal(refused.loadVisual, false, "nothing is converted");
    assert.ok(refused.blocked?.includes("tables"));
  }
});
test("modes: switching is possible where it is safe, and never carries text or an edit", () => {
  const toVisual = changeMode("visual", "preview", null, ORDINARY);
  assert.deepEqual(toVisual, { mode: "visual", blocked: null, refused: null, loadVisual: true });
  for (const target of ["preview", "source"] as const) {
    const change = changeMode(target, "visual", ["tables"], PLAYBOOK_LIKE);
    assert.deepEqual(change, { mode: target, blocked: ["tables"], refused: null, loadVisual: false });
  }
  assert.deepEqual(Object.keys(changeMode("preview", "source", null, "x")).sort(), ["blocked", "loadVisual", "mode", "refused"], "the result holds no note text");
  assert.equal(changeMode("source", "preview", ["tables"], PLAYBOOK_LIKE).mode, "source", "an unsafe note can always be edited as source");
});
test("data preservation: building the preview or switching modes changes neither the text nor the guard's verdict", () => {
  const before = JSON.stringify(checkVisualSafety(PLAYBOOK_LIKE));
  const copy = String(PLAYBOOK_LIKE);
  buildPreview(PLAYBOOK_LIKE);
  changeMode("preview", "visual", null, PLAYBOOK_LIKE);
  changeMode("visual", "preview", null, PLAYBOOK_LIKE);
  assert.equal(PLAYBOOK_LIKE, copy);
  assert.equal(JSON.stringify(checkVisualSafety(PLAYBOOK_LIKE)), before);
  assert.equal(noteToMarkdown({ title: "T", body: PLAYBOOK_LIKE }), `# T\n\n${PLAYBOOK_LIKE.replace(/\n+$/, "")}\n`, "export still writes the saved body unchanged");
});

test("preview wiring (static): read-only component, no save or dirty path, mode switch reports nothing", () => {
  const preview = read("components/notes/markdown-preview.tsx");
  assert.ok(/export function MarkdownPreview\(\{ source, className \}/.test(preview), "the preview takes only the text to show");
  assert.ok(!/onChange|onDraftChange|onSave|onCancel|useEditor|supabase/.test(preview));
  assert.ok(/type="button"/.test(preview), "the Copy button never submits a form");
  assert.ok(/copyText\(/.test(preview) && !/execCommand/.test(preview));
  const editor = read("components/notes/rich-text-editor.tsx");
  assert.ok(/<MarkdownPreview source=\{value\} \/>/.test(editor), "the editor passes text only, no callbacks");
  const select = /function selectMode\([\s\S]*?\n  }\n/.exec(editor)?.[0] ?? "";
  assert.ok(select.length > 100 && !/onChange|onChangeRef|lastSynced\.current = /.test(select.replace(/lastSynced\.current = value;/, "")), "switching modes does not report an edit");
  assert.ok(/emitUpdate:\s*false/.test(select), "loading the visual editor is never reported as an edit");
});
test("preview styling (static): tables scroll sideways, code keeps its line breaks", () => {
  const css = read("app/globals.css");
  assert.ok(/\.md-table-wrap\s*\{[^}]*overflow-x-auto/.test(css));
  assert.ok(/\.md-code pre\s*\{[^}]*white-space:\s*pre-wrap/.test(css));
});
test("no Markdown renderer or highlighter package was added for the preview", () => {
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(!all.some((n) => /^(react-markdown|remark|rehype|markdown-it|marked|dompurify|sanitize-html|highlight\.js|prismjs|shiki)/.test(n)), all.join());
});

// The first 600 characters of a plain-prose body, as the preview has always shown them.
const cleanFirst600 = (body: string) => body.slice(0, 600).replace(/\s+/g, " ").trim();
// --- Final refinements of Feature 8.1 ------------------------------------------------------
test("notice: Preview shows no compatibility warning, also for a note that opens there because of a table", () => {
  const blocked = ["tables"];
  assert.equal(modeNotice("preview", blocked, null), null, "a note that opens in Preview shows no warning");
  assert.equal(modeNotice("preview", null, null), null);
  assert.equal(modeNotice("visual", null, null), null);
  assert.equal(modeNotice("visual", blocked, null), null);
});
test("notice: Markdown source still explains why the note is edited as source (unchanged)", () => {
  assert.equal(modeNotice("source", ["tables"], null), sourceModeNotice(["tables"]));
  assert.match(modeNotice("source", ["tables", "HTML"], null) ?? "", /tables, HTML/);
  assert.equal(modeNotice("source", null, null), null, "an ordinary note edited as source shows nothing");
});
test("notice: asking for the visual editor on an unsupported note is refused and explained, in Preview too", () => {
  const change = changeMode("visual", "preview", ["tables"], PLAYBOOK_LIKE);
  assert.equal(change.mode, "preview", "the guard still prevents unsafe visual editing");
  assert.equal(change.loadVisual, false);
  assert.ok(change.refused?.includes("tables"));
  const text = modeNotice("preview", change.blocked, change.refused);
  assert.ok(text && /^This note contains tables.*which the visual editor cannot keep intact/.test(text), text ?? "");
  assert.ok(/Markdown source/.test(text ?? "") && /nothing was changed/.test(text ?? ""), "it says where to edit and that nothing changed");
  // the explanation goes away with the next mode change
  assert.equal(changeMode("source", "preview", change.blocked, PLAYBOOK_LIKE).refused, null);
  assert.equal(changeMode("preview", "source", change.blocked, PLAYBOOK_LIKE).refused, null);
  // an ordinary note is never refused
  assert.equal(changeMode("visual", "preview", null, ORDINARY).refused, null);
});
test("notice (static): the editor takes its notice from modeNotice and keeps the guard in changeMode", () => {
  const editor = read("components/notes/rich-text-editor.tsx");
  assert.ok(editor.includes("modeNotice(mode, blocked, refused)"));
  assert.ok(!/previewNotice|sourceModeNotice\(/.test(editor), "no ad-hoc notice logic in the component");
  assert.ok(editor.includes("changeMode(target, mode, blocked, value)"));
  assert.ok(/setRefused\(change\.refused\)/.test(editor));
});

test("note list preview: a table never shows its pipes or separator rows while the note has prose", () => {
  const body = ["## Overview", "", "| Field | Value |", "|:--|--:|", "| Chapter | 00 |", "| Title | **Setup** |", "", "This note explains the *setup* of the project."].join("\n");
  const preview = plainTextPreview(body);
  assert.equal(preview, "Overview This note explains the setup of the project.");
  assert.ok(!/[|]|-{2,}/.test(preview));
});
test("note list preview: separator rows in every common form are dropped", () => {
  for (const sep of ["|---|---|", "| --- | --- |", "|:--|:-:|--:|", "--|--", ":--|--:", "|-|-|", "  |---|  "]) {
    const preview = plainTextPreview(`Intro text\n\n| a | b |\n${sep}\n| 1 | 2 |\n\nAfter text`);
    assert.equal(preview, "Intro text After text", sep);
  }
  assert.equal(plainTextPreview("Intro\n\n---\n\nOutro"), "Intro Outro", "a plain rule is not a table separator");
});
test("note list preview: a note that is only tables shows the text of its cells, readable", () => {
  const body = "| Step | Task |\n|---|---|\n| 00.01 | Scope and **evidence** |\n| 00.02 | Escaped \\| pipe |";
  const preview = plainTextPreview(body);
  assert.equal(preview, "Step · Task 00.01 · Scope and evidence 00.02 · Escaped | pipe");
  assert.ok(!/---/.test(preview));
});
test("note list preview: prose is preferred over code; a note that is only code shows the code", () => {
  assert.equal(plainTextPreview("```text\nconst a = 1;\n```\n\nThe explanation of the code."), "The explanation of the code.");
  assert.equal(plainTextPreview("Before\n\n```sh\nnpm run dev\n```\n\nAfter"), "Before After");
  assert.equal(plainTextPreview("```text\nFirst line of a prompt\n  indented\n```"), "First line of a prompt indented");
  assert.equal(plainTextPreview("~~~\ntilde fenced\n~~~"), "tilde fenced");
  assert.equal(plainTextPreview("| a |\n|---|\n\n```\ncode here\n```"), "a", "tables come before code as the fallback");
});
test("note list preview: unusual input falls back gracefully and never throws", () => {
  for (const body of ["", "\n\n", "|", "|||", "| |\n|---|", "```", "```\n", "---", "x".repeat(20000), "| a | b |\n".repeat(3000), "```\n" + "line\n".repeat(5000)]) {
    assert.doesNotThrow(() => plainTextPreview(body), body.slice(0, 10));
    assert.ok(plainTextPreview(body).length <= 600);
  }
  assert.equal(plainTextPreview("|---|---|"), "|---|---|", "a lone separator line (no header above it) is ordinary text, as before");
  assert.equal(plainTextPreview("| a | b |\n".repeat(3000)).length <= 600, true);
});
test("note list preview: notes without tables or code give exactly the same preview as before", () => {
  const cases: [string, string][] = [
    ["# T\n\n**b** <u>u</u> [l](https://a.b)\n- x", "T b u l x"],
    ["1986. A good year", "1986. A good year"],
    ["Plain text only.\nSecond line.", "Plain text only. Second line."],
    ["> quote\n\n- a\n- b", "quote a b"],
  ];
  for (const [body, expected] of cases) assert.equal(plainTextPreview(body), expected);
  const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
  assert.equal(plainTextPreview(long), cleanFirst600(long));
});
test("note list preview: the stored Markdown is only read, and the guard's verdict does not change", () => {
  const before = JSON.stringify(checkVisualSafety(PLAYBOOK_LIKE));
  const copy = String(PLAYBOOK_LIKE);
  plainTextPreview(PLAYBOOK_LIKE);
  assert.equal(PLAYBOOK_LIKE, copy);
  assert.equal(JSON.stringify(checkVisualSafety(PLAYBOOK_LIKE)), before);
  const preview = plainTextPreview(PLAYBOOK_LIKE);
  assert.ok(preview.startsWith("A. Overview"), preview);
  assert.ok(!/[|]|:--|---/.test(preview), preview);
  assert.ok(!/(^|\s)\*\*|`/.test(preview), "no Markdown marks are left");
});

// --- Review corrections of Feature 8.1 (independent review, 2026-10-15) ---------------------------
test("M1: a note with YAML front matter is previewed as its own block, not as a rule and a heading", () => {
  const body = "---\ntitle: Notes\ntags: [a, b]\n---\n\n# Body title\n\nText.";
  const tree = buildPreview(body);
  assert.deepEqual(kinds(tree), ["code", "heading", "paragraph"]);
  const front = asBlock(tree, "code");
  assert.equal(front.lang, "yaml");
  assert.equal(front.text, "---\ntitle: Notes\ntags: [a, b]\n---", "the metadata is shown as written");
  assert.ok(!kinds(tree).includes("hr"));
  assert.equal(codeBlockTexts(tree)[0], front.text);
  // only front matter; CRLF and a BOM are handled like the guard and the export handle them
  assert.deepEqual(kinds(buildPreview("---\nk: v\n---")), ["code"]);
  assert.deepEqual(kinds(buildPreview("---\r\nk: v\r\n---\r\n\r\nBody")), ["code", "paragraph"]);
  assert.deepEqual(kinds(buildPreview("﻿---\nk: v\n---\n\nBody")), ["code", "paragraph"]);
  // not front matter: an ordinary rule between paragraphs, and an unclosed block, render as before
  assert.deepEqual(kinds(buildPreview("Intro\n\n---\n\nOutro")), ["paragraph", "hr", "paragraph"]);
  assert.equal(kinds(buildPreview("---\nk: v\nno closing line")).includes("code"), false);
});
test("M2: tables without a leading pipe are recognised, in the note-list preview too", () => {
  assert.equal(plainTextPreview("Name | Age\n--- | ---\nAnn | 30\n\nSome prose"), "Some prose");
  assert.equal(plainTextPreview("a|b\n-|-\n1|2"), "a · b 1 · 2", "a table-only note shows its cells");
  assert.equal(plainTextPreview("Before\n\nName | Age\n:-- | --:\nAnn | 30\nBob | 41\n\nAfter"), "Before After");
  assert.equal(plainTextPreview("Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\nNot a row\n"), "Intro Not a row", "rows end at the first line without a pipe");
  assert.equal(plainTextPreview("A | B is not a table\n\nplain"), "A | B is not a table plain", "a pipe without a separator row stays prose");
});
test("L3: notes without tables or fenced code give exactly the same preview as before (differential test)", () => {
  // The implementation on main, copied exactly.
  const before = (body: string) =>
    unescapeMarkdown(body.slice(0, 600))
      .replace(/```[^\n]*\n?/g, "")
      .replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
      .replace(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
      .replace(/<\/?u>/g, "")
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d{1,3}[.)]\s+(?=\S)|(-{3,}|\*{3,}|_{3,})\s*$)/gm, "")
      .replace(/\*\*|__|~~|`/g, "")
      .replace(/\*(?=\S)([^*\n]*\S)\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  for (const body of ["x\n*", "*", "-", "#", ">", "| starts with pipe\nmore", "|x", "text\n\n---\n\nmore", "a\n- \nb"]) assert.equal(plainTextPreview(body), before(body), JSON.stringify(body));
  const lines = ["plain text here", "# Title", "## Sub", "- a", "* b", "+ c", "1. one", "2) two", "> quote", "---", "***", "___", "", "   ", "**bold** and *it*", "[l](http://x.y)", "snake\\_case", "5 &lt; 6", "*", "-", "#", ">", "text with `code`", "<u>u</u>", "| a", "| a |", "|x", "tab\there", "äöü \u{1f600}"];
  let seed = 12345;
  const next = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
  for (let i = 0; i < 3000; i++) {
    const body = Array.from({ length: 1 + next(40) }, () => lines[next(lines.length)]).join(next(7) === 0 ? "\r\n" : "\n");
    assert.equal(plainTextPreview(body), before(body), JSON.stringify(body.slice(0, 80)));
  }
});
test("L4: long lines are cheap in the note list (no quadratic matching)", () => {
  const worst = ["|-" + " ".repeat(19990) + "x", " ".repeat(19990) + "|x", "\t".repeat(19990) + "|-", "|" + "-".repeat(19990) + "x", "|-".repeat(9990) + "x", "a|".repeat(9990)];
  for (const body of worst) {
    const t0 = performance.now();
    plainTextPreview(body);
    plainTextPreview(`${body}\n${body}`);
    assert.ok(performance.now() - t0 < 50, `${body.slice(0, 12)}... took ${(performance.now() - t0).toFixed(0)} ms`);
  }
});
test("L5: column alignment applies to header and body cells", () => {
  const table = asBlock(buildPreview("| L | C | R | D |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |"), "table");
  assert.deepEqual(table.align, ["left", "center", "right", null]);
  const component = read("components/notes/markdown-preview.tsx");
  assert.ok(/ALIGN_CLASS\[align \?\? "left"\]/.test(component), "an unaligned column is left-aligned by class");
  assert.ok(/<th key=\{j\} scope="col" className=\{alignClass\(block\.align\[j\]\)\}/.test(component), "header cells take the alignment class");
  const css = read("app/globals.css");
  const th = /\.md-preview th\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.ok(th.length > 0 && !/text-(left|center|right)/.test(th), "no CSS rule on th may override the alignment classes");
});
test("L6: only fenced code blocks get a Copy button", () => {
  const tree = buildPreview("    indented code\n\n```sh\nnpm run dev\n```\n");
  const codes = tree.filter((b) => b.kind === "code") as Extract<Block, { kind: "code" }>[];
  assert.deepEqual(codes.map((c) => c.fenced), [false, true]);
  assert.deepEqual(codeBlockTexts(tree), ["npm run dev"], "the button list holds fenced blocks only");
  assert.equal(codes[0].text, "indented code", "an indented block is still shown, unchanged");
  assert.ok(/\{fenced && \(/.test(read("components/notes/markdown-preview.tsx")));
});
test("L7: each Copy button has a name that says which block it copies; the result is announced separately", () => {
  const component = read("components/notes/markdown-preview.tsx");
  assert.ok(/aria-label=\{`Copy \$\{lang \|\| "code"\} block`\}/.test(component));
  assert.ok(/role="status" className="sr-only"/.test(component), "Copied and Copy failed reach screen readers");
});

test("Cancel (existed before Feature 8.1): the restored saved text is checked again and never loaded into the visual editor when it is not safe", () => {
  const savedWithTable = "Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
  const restored = restoreVisual(savedWithTable);
  assert.equal(restored.loadVisual, false, "unsupported Markdown is not loaded into the visual editor");
  assert.equal(restored.mode, "preview", "the note falls back to the read-only Preview");
  assert.ok(restored.refused?.includes("tables") && restored.blocked?.includes("tables"));
  assert.match(modeNotice(restored.mode, restored.blocked, restored.refused) ?? "", /tables.*visual editor cannot keep intact/, "the user is told why the mode changed");
  for (const unsafe of ["![i](http://x/y.png)", "- [ ] task", "<div>x</div>", "---\ntitle: x\n---\n\nbody"]) assert.equal(restoreVisual(unsafe).loadVisual, false, unsafe.slice(0, 18));
  assert.deepEqual(restoreVisual(ORDINARY), { mode: "visual", blocked: null, refused: null, loadVisual: true }, "a safe saved text is restored into the visual editor as before");
  assert.deepEqual(Object.keys(restored).sort(), ["blocked", "loadVisual", "mode", "refused"], "the result holds no note text: the draft stays the restored saved text");
});
test("Cancel (static): the reset effect asks the guard before it loads anything into the editor", () => {
  const editor = read("components/notes/rich-text-editor.tsx");
  const effect = /\/\/ Cancel \(or any reset from outside\)[\s\S]*?\n  \}, \[editor, mode, value\]\);/.exec(editor)?.[0] ?? "";
  assert.ok(effect.length > 200, "the effect was found");
  assert.ok(effect.indexOf("restoreVisual(value)") > -1 && effect.indexOf("restoreVisual(value)") < effect.indexOf("setContent("), "the guard runs first");
  assert.ok(/if \(restored\.loadVisual\) \{\s*editor\.commands\.setContent/.test(effect), "setContent only when the guard allows it");
  assert.ok(!/onChange|onDraftChange/.test(effect), "restoring is never reported as an edit");
});

if (failed > 0) {
  console.error(`\n${failed} editor test(s) failed`);
  process.exit(1);
}
console.log("\nall editor tests passed");
