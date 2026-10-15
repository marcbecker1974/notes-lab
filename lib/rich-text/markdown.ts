// Markdown <-> editor conversion and the data-loss guard for the rich-text editor
// (Feature 8). The note body is stored as Markdown in `notes.body`; underline has no
// Markdown syntax, so it is written as inline HTML: `<u>text</u>`.
//
// This module has no DOM and no Supabase access, so `npm run test:editor` (plain
// Node) can test it. The editor component builds its extensions from the same list.

import type { AnyExtension, JSONContent } from "@tiptap/react";
import { Underline } from "@tiptap/extension-underline";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/** `<u>…</u>` with the inner text parsed as Markdown, so bold, italic and links inside survive. */
export const MarkdownUnderline = Underline.extend({
  renderMarkdown(node, helpers) {
    return `<u>${helpers.renderChildren(node)}</u>`;
  },
  markdownTokenizer: {
    name: "underline",
    level: "inline",
    start: (src: string) => src.indexOf("<u>"),
    tokenize(src, _tokens, lexer) {
      const match = /^<u>([\s\S]+?)<\/u>/.exec(src);
      if (!match) return undefined;
      return {
        type: "underline",
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  },
});

/** The editor's content extensions, without the Markdown extension itself. */
export function contentExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      underline: false,
      link: {
        openOnClick: false,
        autolink: false,
        isAllowedUri: (url) => isAllowedLinkUri(url),
      },
    }),
    MarkdownUnderline,
  ];
}

let manager: MarkdownManager | null = null;
function markdown(): MarkdownManager {
  manager ??= new MarkdownManager({ extensions: contentExtensions() });
  return manager;
}

/** Markdown as saved, without the trailing blank lines the serializer appends. */
export function serializeMarkdown(doc: JSONContent): string {
  return markdown().serialize(doc).replace(/\s+$/, "");
}

export function parseMarkdown(source: string): JSONContent {
  return markdown().parse(source);
}

// --- Links (only http, https and mailto) ---------------------------------------
//
// Two gates: `normalizeLinkInput` for what a user types into the link field (strict,
// adds https:// to a bare address) and `isAllowedLinkUri` for links parsed from stored
// Markdown or pasted (a relative link stays; an unsafe protocol never becomes a
// clickable link, though the stored Markdown is left as it is).

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// Whitespace and control characters (also hide "java\tscript:" from naive checks).
const BAD_CHARS = /[\s\u0000-\u001f\u007f-\u009f]/;

export const LINK_ERROR = "Only http, https and mailto links are allowed.";

function protocolOf(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

/** The link to store for what the user typed, or null when it is not allowed. */
export function normalizeLinkInput(input: string): string | null {
  const value = input.trim();
  if (value === "" || BAD_CHARS.test(value)) return null;
  let candidate = value;
  if (!HAS_SCHEME.test(value)) {
    // "name@example.com" is an e-mail address; anything else a web address.
    candidate = /^[^@/:]+@[^@/:]+\.[^@/:]+$/.test(value) ? `mailto:${value}` : `https://${value}`;
  }
  const protocol = protocolOf(candidate);
  return protocol !== null && ALLOWED_PROTOCOLS.includes(protocol) ? candidate : null;
}

/** For links that come from stored or pasted content: relative links pass, other schemes must be allowed. */
export function isAllowedLinkUri(url: string | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return false;
  if (!HAS_SCHEME.test(value)) return true;
  const protocol = protocolOf(value);
  return protocol !== null && ALLOWED_PROTOCOLS.includes(protocol);
}

// --- The data-loss guard ----------------------------------------------------------

export type VisualCheck = { safe: true } | { safe: false; reasons: string[] };

type Token = {
  type: string;
  raw?: string;
  text?: string;
  href?: string;
  task?: boolean;
  tokens?: Token[];
  items?: Token[];
  rows?: unknown;
};

function walk(tokens: Token[] | undefined, visit: (token: Token) => void) {
  for (const token of tokens ?? []) {
    visit(token);
    walk(token.tokens, visit);
    walk(token.items, visit);
  }
}

// Letters and digits only: what a reader would call the words of the note.
const words = (text: string) =>
  text
    .normalize("NFC")
    .replace(/&(lt|gt|amp|quot|#39);/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

// The serializer writes a bare URL or e-mail address as `[x](x)`: the same link in
// Markdown, so it does not count as lost content.
const collapseSelfLinks = (text: string) =>
  text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label: string, target: string) =>
    label === target || `mailto:${label}` === target ? label : all,
  );

function docParts(doc: JSONContent) {
  const links: string[] = [];
  const code: string[] = [];
  const visit = (node: JSONContent) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === "link") links.push(String(mark.attrs?.href ?? ""));
      if (mark.type === "code" && node.text) code.push(node.text);
    }
    if (node.type === "codeBlock") code.push((node.content ?? []).map((c) => c.text ?? "").join(""));
    (node.content ?? []).forEach(visit);
  };
  visit(doc);
  return { links, code };
}

// YAML front matter: a first line `---`, then only `key: value`, list, indented or
// comment lines, closed by `---` or `...`. The editor would turn it into a rule and a
// heading (`## title: x`), so such a note stays in source mode. A rule, some prose and
// another rule is not front matter (a prose line is not a YAML line).
const FRONT_MATTER = /^\uFEFF?---[ \t]*\r?\n((?:(?![ \t]*(?:---|\.\.\.)[ \t]*$)[^\n]*\n?)*?)[ \t]*(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const YAML_LINE = /^(?:[ \t]*$|[ \t]*#|[ \t]+\S|[ \t]*-(?:[ \t]|$)|[^\s:#][^:\n]*:(?:[ \t]|$))/;

/** True when the Markdown starts with a YAML front matter block. */
export function hasFrontMatter(source: string): boolean {
  const match = FRONT_MATTER.exec(source);
  if (!match) return false;
  const lines = match[1].split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.length > 0 && lines.every((line) => YAML_LINE.test(line)) && lines.some((line) => /^[^\s#-][^:\n]*:/.test(line));
}

/**
 * Can the visual editor show this Markdown and write it back without losing content?
 * Unsafe notes open in source mode, where the raw text is edited and saved as is.
 * Three layers: structures the editor has no node for (tables, images, task lists,
 * footnotes, raw HTML other than `<u>`), then a comparison of the words, link
 * targets and code before and after a round trip, and a failure to convert at all.
 */
export function checkVisualSafety(source: string): VisualCheck {
  const reasons = new Set<string>();
  if (hasFrontMatter(source)) reasons.add("YAML front matter");
  try {
    const m = markdown();
    const tokens = m.instance.lexer(source) as unknown as Token[];
    const links: string[] = [];
    const code: string[] = [];
    walk(tokens, (token) => {
      if (token.type === "table") reasons.add("tables");
      else if (token.type === "image") reasons.add("images");
      else if (token.type === "html") reasons.add("HTML");
      else if (token.type === "list_item" && token.task) reasons.add("task lists");
      else if (token.type === "link" && token.href !== undefined) links.push(token.href);
      else if (token.type === "code" || token.type === "codespan") code.push(token.text ?? "");
    });
    const withoutCode = source.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "");
    if (/\[\^[^\]\n]+\]/.test(withoutCode)) reasons.add("footnotes");

    const doc = m.parse(source);
    const saved = serializeMarkdown(doc);
    if (words(collapseSelfLinks(saved)) !== words(source)) reasons.add("content the editor cannot represent");
    const after = docParts(doc);
    if (JSON.stringify(after.links) !== JSON.stringify(links)) reasons.add("link targets");
    // The saved text must still be read back as the same links (an address with a
    // space, for instance, stops being a link once written without angle brackets).
    const reread: string[] = [];
    walk(m.instance.lexer(saved) as unknown as Token[], (token) => {
      if (token.type === "link" && token.href !== undefined) reread.push(token.href);
    });
    if (JSON.stringify(reread) !== JSON.stringify(links)) reasons.add("link targets");
    if (JSON.stringify(after.code) !== JSON.stringify(code)) reasons.add("code");
  } catch {
    reasons.add("content that could not be converted");
  }
  return reasons.size === 0 ? { safe: true } : { safe: false, reasons: [...reasons] };
}

/** A sentence for the notice shown above the source editor. */
export function sourceModeNotice(reasons: string[]): string {
  return `This note contains ${reasons.join(", ")}, which the visual editor cannot keep intact. It is shown as Markdown source so nothing is lost; you can edit and save it here.`;
}
