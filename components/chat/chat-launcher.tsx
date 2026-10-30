"use client";

import { Bot, X } from "lucide-react";
import { useRef, useState } from "react";

import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Floating chat for private pages: a round bot button at the bottom-right opens a
// panel, and the X (or Escape) closes it. The panel stays mounted while closed, so the
// conversation survives closing and reopening; a reload starts a new one. Below 640px
// the open panel fills the screen. The model call happens in POST /api/chat only.
export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  return (
    <>
      <div
        id="chat-widget"
        role="dialog"
        aria-label="Chat"
        aria-hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={cn(
          "fixed inset-0 z-50 flex-col bg-background shadow-xl",
          "pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
          "sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[560px] sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-xl sm:border sm:p-0",
          open ? "flex" : "hidden",
        )}
      >
        <ChatPanel
          active={open}
          headerEnd={
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close chat">
              <X />
            </Button>
          }
        />
      </div>
      <Button
        ref={launcherRef}
        size="icon"
        className={cn(
          "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full shadow-lg",
          open && "max-sm:hidden",
        )}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Minimise chat" : "Open chat"}
        aria-expanded={open}
        aria-controls="chat-widget"
      >
        {open ? <X className="!size-6" /> : <Bot className="!size-6" />}
      </Button>
    </>
  );
}
