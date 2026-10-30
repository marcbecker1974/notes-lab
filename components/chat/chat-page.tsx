"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";

// Full-page fallback for the floating chat: same panel, same conversation logic.
export function ChatPage() {
  return (
    <div className="mx-auto h-dvh max-w-3xl">
      <ChatPanel
        headerStart={
          <Button asChild variant="ghost" size="icon" aria-label="Back to notes">
            <Link href="/notes"><ArrowLeft /></Link>
          </Button>
        }
      />
    </div>
  );
}
