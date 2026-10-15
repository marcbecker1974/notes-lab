"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LINK_ERROR,
  checkVisualSafety,
  contentExtensions,
  normalizeLinkInput,
  serializeMarkdown,
  sourceModeNotice,
} from "@/lib/rich-text/markdown";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";

type RichTextEditorProps = {
  /** The note body as Markdown (the draft). */
  value: string;
  /** Called with the new Markdown, only when the user changes the content. */
  onChange: (markdown: string) => void;
  invalid?: boolean;
};

/**
 * Visual editor (Tiptap) and Markdown source editor for a note body. The draft stays
 * a Markdown string, so Save, Cancel and unsaved-changes handling are the note
 * editor's own. Nothing is reported while a note is only opened, converted or shown
 * in another mode: the original Markdown is kept exactly until the user edits.
 */
export function RichTextEditor({ value, onChange, invalid }: RichTextEditorProps) {
  // Decided once per opened note (the parent keys this component by note id).
  const [initial] = useState(() => checkVisualSafety(value));
  const [mode, setMode] = useState<"visual" | "source">(initial.safe ? "visual" : "source");
  const [blocked, setBlocked] = useState<string[] | null>(initial.safe ? null : initial.reasons);
  const [fullscreen, setFullscreen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // The Markdown the editor last reported or was last given: tells our own edits
  // from a reset by the parent (Cancel).
  const lastSynced = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...contentExtensions(), Markdown],
    content: initial.safe ? value : "",
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "rich-text",
        role: "textbox",
        "aria-labelledby": "note-body-label",
        "aria-multiline": "true",
      },
    },
    // Fires for changes to the document only (typing, toolbar, paste), not for content set with emitUpdate: false.
    onUpdate: ({ editor: current, transaction }) => {
      if (!transaction.docChanged) return;
      const markdown = serializeMarkdown(current.getJSON());
      lastSynced.current = markdown;
      onChangeRef.current(markdown);
    },
  });

  // Cancel (or any reset from outside) puts the saved Markdown back into the editor.
  useEffect(() => {
    if (!editor || mode !== "visual" || value === lastSynced.current) return;
    editor.commands.setContent(value, { emitUpdate: false, contentType: "markdown" });
    lastSynced.current = value;
  }, [editor, mode, value]);

  // Escape leaves full screen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  function toggleSource() {
    if (mode === "visual") {
      setLinkOpen(false);
      setMode("source");
      return;
    }
    const check = checkVisualSafety(value);
    if (!check.safe) {
      setBlocked(check.reasons);
      return;
    }
    if (editor) {
      editor.commands.setContent(value, { emitUpdate: false, contentType: "markdown" });
      lastSynced.current = value;
    }
    setBlocked(null);
    setMode("visual");
  }

  function toggleLink() {
    if (!editor) return;
    if (linkOpen) {
      setLinkOpen(false);
      return;
    }
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const href = normalizeLinkInput(linkValue);
    if (href === null) {
      setLinkError(LINK_ERROR);
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // No text selected: insert the address itself as the linked text.
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div
      className={cn(
        "flex flex-col border border-border bg-background",
        fullscreen ? "fixed inset-0 z-50 rounded-none" : "rounded-md",
        invalid && "border-destructive",
      )}
    >
      <EditorToolbar
        editor={editor}
        sourceMode={mode === "source"}
        fullscreen={fullscreen}
        linkOpen={linkOpen}
        onToggleLink={toggleLink}
        onToggleSource={toggleSource}
        onToggleFullscreen={() => setFullscreen((on) => !on)}
      />

      {fullscreen && (
        <div className="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-sm text-muted-foreground">
          <span className={invalid ? "font-medium text-destructive" : undefined}>
            {invalid
              ? "Over the character limit: shorten the note to save it. Nothing is cut automatically."
              : "Full screen. Your changes are kept; Save and Cancel are on the note."}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setFullscreen(false)}>
            <X /> Exit full screen
          </Button>
        </div>
      )}

      {linkOpen && mode === "visual" && (
        <form
          onSubmit={applyLink}
          onKeyDown={(event) => {
            // Escape closes the link bar only, not full screen behind it.
            if (event.key === "Escape") {
              event.preventDefault();
              setLinkOpen(false);
            }
          }}
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        >
          <Input
            value={linkValue}
            onChange={(event) => {
              setLinkValue(event.target.value);
              setLinkError(null);
            }}
            aria-label="Link address"
            aria-invalid={linkError !== null}
            placeholder="https://example.com"
            autoFocus
            className="h-8 min-w-[12rem] flex-1 text-sm"
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
          {editor?.isActive("link") && (
            <Button type="button" variant="outline" size="sm" onClick={removeLink}>
              Remove link
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
          {linkError && (
            <p role="alert" className="basis-full text-sm text-destructive">
              {linkError}
            </p>
          )}
        </form>
      )}

      {blocked && (
        <p role="status" className="border-b bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {sourceModeNotice(blocked)}
        </p>
      )}

      <div className={cn("min-h-0", fullscreen && "flex-1 overflow-y-auto")}>
        <div className={mode === "visual" ? undefined : "hidden"}>
          <EditorContent editor={editor} />
        </div>
        {mode === "source" && (
          <Textarea
            id="note-body"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            aria-invalid={invalid}
            aria-labelledby="note-body-label"
            placeholder="Write your note in Markdown..."
            className={cn(
              "min-h-[460px] resize-y rounded-none border-0 p-6 font-mono text-[15px] leading-[1.5] shadow-none focus-visible:ring-0 md:text-[15px]",
              fullscreen && "h-full min-h-[60vh]",
            )}
          />
        )}
      </div>
    </div>
  );
}
