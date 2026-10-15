// Probe for the front matter performance tests in test-editor.mts. It runs in its own
// process so the test can enforce a timeout. Usage: node scripts/front-matter-probe.mts <new|old> <case> <n>
// `old` is the regex that backtracked exponentially (kept only as a control: the test
// expects the timeout to kill it); `new` runs the real detection, guard and export.
import { splitFrontMatter, noteToMarkdown } from "../lib/note-markdown.ts";
import { checkVisualSafety, hasFrontMatter } from "../lib/rich-text/markdown.ts";

const [mode, name, count] = process.argv.slice(2);
const n = Number(count);
const lines = (line: string, times: number) => line.repeat(times);
const cases: Record<string, string> = {
  unclosed: `---\n${lines("k: v\n", n)}`,
  unclosedCrlf: `---\r\n${lines("k: v\r\n", n)}`,
  longLine: `---\n${"a".repeat(n)}`,
  longKeyLine: `---\nk: ${"a".repeat(n)}`,
  validLf: `---\n${lines("k: v\n", n)}---\nbody`,
  validCrlfBom: `﻿---\r\n${lines("k: v\r\n", n)}...\r\nbody`,
  malformed: `---\n${lines("k: v\n", n)}not a yaml line\n---\nbody`,
  rules: lines("---\n\ntext\n\n", n),
  manyRules: lines("---\n", n),
};
const input = cases[name];
if (input === undefined) throw new Error(`unknown case ${name}`);

const started = performance.now();
if (mode === "old") {
  const OLD = /^﻿?---[ \t]*\r?\n((?:(?![ \t]*(?:---|\.\.\.)[ \t]*$)[^\n]*\n?)*?)[ \t]*(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
  OLD.exec(input);
  console.log(JSON.stringify({ ms: performance.now() - started }));
} else {
  const split = splitFrontMatter(input);
  const detected = hasFrontMatter(input);
  const exported = noteToMarkdown({ title: "T", body: input });
  const safe = checkVisualSafety(input).safe;
  console.log(
    JSON.stringify({
      ms: performance.now() - started,
      detected,
      safe,
      frontLines: split ? split.front.split("\n").length : 0,
      restStart: split ? split.rest.slice(0, 4) : null,
      exportStartsWithRule: exported.startsWith("---\n"),
      exportEndsWithTitleAndBody: exported.endsWith("\n# T\n\nbody\n"),
      exportTitleOnly: exported === "# T\n" ? true : exported.startsWith("# T\n"),
    }),
  );
}
