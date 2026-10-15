// Tests for the rich-text editor's Markdown layer (Feature 8). Run: npm run test:editor
// Plain Node, no DOM and no database: conversion, the data-loss guard, link rules,
// export compatibility and static checks. Browser behaviour (toolbar clicks, source
// and fullscreen switching) is verified manually; see REFLECTION.md.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { JSONContent } from "@tiptap/react";
import {
  checkVisualSafety,
  hasFrontMatter,
  isAllowedLinkUri,
  normalizeLinkInput,
  parseMarkdown,
  serializeMarkdown,
} from "../lib/rich-text/markdown.ts";
import { plainTextPreview, unescapeMarkdown } from "../lib/rich-text/preview.ts";
import { matchesQuery } from "../lib/notes-view.ts";
import { markdownFilename, noteToMarkdown } from "../lib/note-markdown.ts";

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
  // The editor opens an unsafe note in source mode, and only reports user edits.
  const component = read("components/notes/rich-text-editor.tsx");
  assert.ok(component.includes('initial.safe ? "visual" : "source"'));
  assert.ok(component.includes("!transaction.docChanged"));
  assert.ok(component.includes("emitUpdate: false"));
  // Switching to visual is refused while the guard says unsafe.
  assert.ok(/const check = checkVisualSafety\(value\);\s+if \(!check\.safe\) \{/.test(component));
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
  for (const file of ["lib/rich-text/markdown.ts", "components/notes/rich-text-editor.tsx", "components/notes/editor-toolbar.tsx", "scripts/test-editor.mts"]) {
    for (const m of read(file).matchAll(/from "(@tiptap\/[^"]+)"/g)) assert.ok(approved.test(m[1]), `${file}: ${m[1]}`);
  }
});

// --- Static checks ----------------------------------------------------------------------
const editorFiles = ["components/notes/rich-text-editor.tsx", "components/notes/editor-toolbar.tsx"];
test("editor files exist", () => editorFiles.forEach((f) => assert.ok(existsSync(f), f)));
test("no unsafe HTML rendering, no database or Supabase access in the editor layer", () => {
  const files = [...editorFiles, "lib/rich-text/markdown.ts", "lib/rich-text/preview.ts"];
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

if (failed > 0) {
  console.error(`\n${failed} editor test(s) failed`);
  process.exit(1);
}
console.log("\nall editor tests passed");
