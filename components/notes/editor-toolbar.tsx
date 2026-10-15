"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Eye,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pencil,
  Underline,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorMode } from "@/lib/rich-text/editor-mode";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  editor: Editor | null;
  /** Preview, visual editor or Markdown source: the formatting controls work only in the visual editor. */
  mode: EditorMode;
  fullscreen: boolean;
  linkOpen: boolean;
  onToggleLink: () => void;
  onModeChange: (mode: EditorMode) => void;
  onToggleFullscreen: () => void;
};

const MODES: { value: EditorMode; label: string; icon: ReactNode }[] = [
  { value: "preview", label: "Preview", icon: <Eye /> },
  { value: "visual", label: "Visual", icon: <Pencil /> },
  { value: "source", label: "Source", icon: <Code /> },
];

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-accent text-primary")}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection and focus in the editor when a button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function EditorToolbar(props: ToolbarProps) {
  const { editor, mode, fullscreen } = props;
  // The toolbar follows the selection: which format is active where the cursor is.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      let block = "";
      if (current.isActive("paragraph")) block = "p";
      for (const level of [1, 2, 3]) if (current.isActive("heading", { level })) block = `h${level}`;
      return {
        block,
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        link: current.isActive("link"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
      };
    },
  });
  const off = mode !== "visual" || !editor || !state;

  function setBlock(value: string) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5"
    >
      <div role="group" aria-label="View mode" className="flex rounded-md border bg-background p-0.5">
        {MODES.map((m) => (
          <Button
            key={m.value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 px-2 text-sm", mode === m.value && "bg-accent text-primary")}
            aria-pressed={mode === m.value}
            // Keep the text selection and focus where they are when a button is pressed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onModeChange(m.value)}
          >
            {m.icon}
            {m.label}
          </Button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <Select value={state?.block ?? ""} onValueChange={setBlock} disabled={off}>
        <SelectTrigger className="h-8 w-[8.5rem] text-sm shadow-none" aria-label="Paragraph format">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Normal</SelectItem>
          <SelectItem value="h1">Heading 1</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
        </SelectContent>
      </Select>
      <ToolButton
        label="Bold"
        active={state?.bold}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={state?.italic}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={state?.underline}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </ToolButton>
      <ToolButton
        label={state?.link ? "Edit or remove link" : "Insert link"}
        active={props.linkOpen || state?.link}
        disabled={off}
        onClick={props.onToggleLink}
      >
        <LinkIcon />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        active={state?.bulletList}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={state?.orderedList}
        disabled={off}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton
        label={fullscreen ? "Exit full screen" : "Full screen"}
        active={fullscreen}
        onClick={props.onToggleFullscreen}
      >
        {fullscreen ? <Minimize2 /> : <Maximize2 />}
      </ToolButton>
    </div>
  );
}
