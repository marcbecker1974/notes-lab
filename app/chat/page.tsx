import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatPage as Chat } from "@/components/chat/chat-page";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Chat – Notes Lab" };

// Private like /notes: the session is verified on the server before the chat UI is
// rendered (inside <Suspense> because the check reads cookies). The model call itself
// happens in POST /api/chat; nothing in this page or its components sees the API key.
async function VerifiedChat() {
  await requireUser();
  return <Chat />;
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-dvh items-center justify-center text-sm text-muted-foreground"
          aria-busy="true"
        >
          Checking your session…
        </div>
      }
    >
      <VerifiedChat />
    </Suspense>
  );
}
