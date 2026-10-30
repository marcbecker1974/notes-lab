import type { ReactNode } from "react";

// Citations arrive as markdown links, [Article title](url). Only these are turned into
// links, and only to https Wikipedia pages (the server also drops links it did not get
// from the library search); everything else stays plain text. No HTML is ever built.
const LINK = /\[([^\]]*)\]\((\S+?)\)/g;

function isWikipedia(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /(^|\.)wikipedia\.org$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function ChatText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, url] = match;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      isWikipedia(url) ? (
        <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
          {label || url}
        </a>
      ) : (
        label || whole
      ),
    );
    last = match.index + whole.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
