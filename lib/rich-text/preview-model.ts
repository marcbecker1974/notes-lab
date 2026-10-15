// Read-only Markdown Preview (Feature 8.1): the Markdown token tree turned into a small typed
// tree that React renders as elements. Pure (no DOM, no Supabase), so `npm run test:editor`
// can test it in plain Node.
//
// Safety by construction: nothing here produces an HTML string. Text, code and attribute
// values reach React as values, which it escapes; raw HTML in a note is shown as plain text;
// images are shown as their alt text (nothing is fetched); only absolute http, https and
// mailto addresses become links. The stored Markdown is only read, never changed.

import { splitFrontMatter } from "../note-markdown.ts";
import { lexMarkdown } from "./markdown.ts";

type Tok = {
  type: string;
  text?: string;
  href?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | "";
  task?: boolean;
  checked?: boolean;
  lang?: string;
  codeBlockStyle?: string;
  align?: (string | null)[];
  tokens?: Tok[];
  items?: Tok[];
  header?: Tok[];
  rows?: Tok[][];
};

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong" | "em" | "del" | "u"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "br" };

export type Align = "left" | "center" | "right" | null;

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "text"; children: Inline[] } // the text of a tight list item (no paragraph spacing)
  | { kind: "list"; ordered: boolean; start: number | null; items: ListItem[] }
  | { kind: "quote"; children: Block[] }
  | { kind: "code"; lang: string; text: string; fenced: boolean } // only a fenced block gets a Copy button
  | { kind: "table"; header: Inline[][]; rows: Inline[][][]; align: Align[] }
  | { kind: "hr" }
  | { kind: "html"; text: string }; // raw HTML block: shown as plain text, never rendered

export type ListItem = { task: boolean; checked: boolean; blocks: Block[] };

/** Only absolute http, https and mailto addresses become links; a relative link would navigate away from an open draft. */
export function isPreviewLink(href: string | undefined): href is string {
  if (!href) return false;
  const value = href.trim();
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) return false;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function inline(tokens: Tok[] | undefined): Inline[] {
  const out: Inline[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "text":
        if (token.tokens && token.tokens.length > 0) out.push(...inline(token.tokens));
        else out.push({ kind: "text", text: token.text ?? "" });
        break;
      case "escape":
        out.push({ kind: "text", text: token.text ?? "" });
        break;
      case "strong":
      case "em":
      case "del":
        out.push({ kind: token.type, children: inline(token.tokens) });
        break;
      case "underline":
        out.push({ kind: "u", children: inline(token.tokens) });
        break;
      case "codespan":
        out.push({ kind: "code", text: token.text ?? "" });
        break;
      case "br":
        out.push({ kind: "br" });
        break;
      case "link": {
        const children = inline(token.tokens);
        if (isPreviewLink(token.href)) out.push({ kind: "link", href: token.href.trim(), children });
        else out.push(...children); // an unsafe or relative link is shown as its text
        break;
      }
      case "image":
        out.push({ kind: "text", text: token.text ?? "" }); // alt text only
        break;
      case "html":
        out.push({ kind: "text", text: token.text ?? "" }); // inline HTML is shown as text
        break;
      default:
        if (token.tokens) out.push(...inline(token.tokens));
        else if (token.text) out.push({ kind: "text", text: token.text });
    }
  }
  return out;
}

const alignOf = (value: string | null | undefined): Align =>
  value === "left" || value === "center" || value === "right" ? value : null;

function blocks(tokens: Tok[] | undefined): Block[] {
  const out: Block[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "space":
      case "def":
      case "checkbox":
        break;
      case "heading":
        out.push({ kind: "heading", level: Math.min(6, Math.max(1, token.depth ?? 1)) as 1 | 2 | 3 | 4 | 5 | 6, children: inline(token.tokens) });
        break;
      case "paragraph":
        out.push({ kind: "paragraph", children: inline(token.tokens) });
        break;
      case "text":
        out.push({ kind: "text", children: token.tokens ? inline(token.tokens) : [{ kind: "text", text: token.text ?? "" }] });
        break;
      case "list":
        out.push({
          kind: "list",
          ordered: token.ordered === true,
          start: token.ordered === true && typeof token.start === "number" && token.start !== 1 ? token.start : null,
          items: (token.items ?? []).map((item) => ({
            task: item.task === true,
            checked: item.checked === true,
            blocks: blocks(item.tokens),
          })),
        });
        break;
      case "blockquote":
        out.push({ kind: "quote", children: blocks(token.tokens) });
        break;
      case "code":
        out.push({ kind: "code", lang: token.lang ?? "", text: token.text ?? "", fenced: token.codeBlockStyle !== "indented" });
        break;
      case "table":
        out.push({
          kind: "table",
          header: (token.header ?? []).map((cell) => inline(cell.tokens)),
          rows: (token.rows ?? []).map((row) => row.map((cell) => inline(cell.tokens))),
          align: (token.align ?? []).map(alignOf),
        });
        break;
      case "hr":
        out.push({ kind: "hr" });
        break;
      case "html":
        out.push({ kind: "html", text: (token.text ?? "").replace(/\n+$/, "") });
        break;
      default:
        if (token.tokens) out.push({ kind: "paragraph", children: inline(token.tokens) });
        else if (token.text) out.push({ kind: "paragraph", children: [{ kind: "text", text: token.text }] });
    }
  }
  return out;
}

/**
 * The Preview tree of a Markdown body. Never throws: an unreadable body is shown as one plain paragraph.
 * A leading YAML front matter block (the same detection as the guard and the export) is shown as its
 * own text in a `yaml` code block, as written, and only the rest is read as Markdown: otherwise its
 * `---` lines would turn into a rule and a heading.
 */
export function buildPreview(source: string): Block[] {
  try {
    const split = splitFrontMatter(source);
    if (!split) return blocks(lexMarkdown(source) as Tok[]);
    const front: Block = { kind: "code", lang: "yaml", text: split.front.replace(/\n+$/, ""), fenced: true };
    return [front, ...blocks(lexMarkdown(split.rest) as Tok[])];
  } catch {
    return [{ kind: "paragraph", children: [{ kind: "text", text: source }] }];
  }
}

/** The text of every code block that has a Copy button (fenced blocks), in order: what each button copies. */
export function codeBlockTexts(tree: Block[]): string[] {
  const out: string[] = [];
  const visit = (list: Block[]) => {
    for (const block of list) {
      if (block.kind === "code") {
        if (block.fenced) out.push(block.text);
      }
      else if (block.kind === "quote") visit(block.children);
      else if (block.kind === "list") for (const item of block.items) visit(item.blocks);
    }
  };
  visit(tree);
  return out;
}
