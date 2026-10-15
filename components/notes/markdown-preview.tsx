"use client";

import { Check, Copy } from "lucide-react";
import { Fragment, createElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/rich-text/copy-text";
import { buildPreview, type Align, type Block, type Inline } from "@/lib/rich-text/preview-model";
import { cn } from "@/lib/utils";

// Read-only formatted view of a note body (Feature 8.1). It receives the Markdown as text and
// nothing else: there is no way to change the draft from here, so showing a note, switching modes
// and copying a code block can never save it or mark it as changed. It builds React elements from
// the Markdown tree (no HTML string), shows raw HTML as plain text and links only http, https and
// mailto addresses.

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.kind) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "code":
        return <code key={i}>{node.text}</code>;
      case "strong":
        return <strong key={i}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(node.children)}</em>;
      case "del":
        return <del key={i}>{renderInline(node.children)}</del>;
      case "u":
        return <u key={i}>{renderInline(node.children)}</u>;
      case "br":
        return <br key={i} />;
      case "link":
        return (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

const ALIGN_CLASS: Record<string, string> = { center: "text-center", right: "text-right", left: "text-left" };
// Columns without an alignment are left-aligned here, not in CSS: a rule on `th` would override these classes.
const alignClass = (align: Align | undefined) => ALIGN_CLASS[align ?? "left"];

function CodeBlock({ lang, text, fenced }: { lang: string; text: string; fenced: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const ok = await copyText(text, typeof navigator === "undefined" ? undefined : navigator.clipboard);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }

  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span className="font-mono">{lang}</span>
        {fenced && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={copy}
              aria-label={`Copy ${lang || "code"} block`}
            >
              {state === "copied" ? <Check /> : <Copy />}
              <span aria-hidden="true">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
            </Button>
            <span role="status" className="sr-only">
              {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
            </span>
          </>
        )}
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.map((block, i) => {
    switch (block.kind) {
      case "heading":
        return createElement(`h${block.level}`, { key: i }, renderInline(block.children));
      case "paragraph":
        return <p key={i}>{renderInline(block.children)}</p>;
      case "text":
        return <span key={i} className="block">{renderInline(block.children)}</span>;
      case "list": {
        const items = block.items.map((item, j) => (
          <li key={j} className={item.task ? "list-none -ml-5 flex gap-2" : undefined}>
            {item.task && <input type="checkbox" checked={item.checked} disabled readOnly aria-label={item.checked ? "Done" : "Not done"} className="mt-1.5" />}
            <div className="min-w-0">{renderBlocks(item.blocks)}</div>
          </li>
        ));
        return block.ordered ? (
          <ol key={i} start={block.start ?? undefined}>{items}</ol>
        ) : (
          <ul key={i}>{items}</ul>
        );
      }
      case "quote":
        return <blockquote key={i}>{renderBlocks(block.children)}</blockquote>;
      case "code":
        return <CodeBlock key={i} lang={block.lang} text={block.text} fenced={block.fenced} />;
      case "table":
        return (
          <div key={i} className="md-table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways when wide)">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, j) => (
                    <th key={j} scope="col" className={alignClass(block.align[j])}>{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, j) => (
                      <td key={j} className={alignClass(block.align[j])}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "hr":
        return <hr key={i} />;
      case "html":
        return <pre key={i} className="md-raw-html">{block.text}</pre>;
    }
  });
}

export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const tree = useMemo(() => buildPreview(source), [source]);
  return (
    <article aria-labelledby="note-body-label" className={cn("md-preview", className)}>
      {tree.length === 0 ? <p className="text-muted-foreground">Nothing to preview yet.</p> : renderBlocks(tree)}
    </article>
  );
}
