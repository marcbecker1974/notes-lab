import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatLauncher } from "@/components/chat/chat-launcher";
import { NotesApp } from "@/components/notes/notes-app";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Notes Lab" };

// The session is verified on the server before the notes UI is rendered; a
// signed-out visitor is redirected to the sign-in page and never receives it. The
// check reads cookies, so it sits inside <Suspense> (cacheComponents). The
// fallback is only a placeholder and carries no notes data. The floating chat is
// rendered here too, so only a verified user ever receives it.
async function VerifiedNotes() {
  await requireUser();
  return (
    <>
      <NotesApp />
      <ChatLauncher />
    </>
  );
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-screen items-center justify-center text-sm text-muted-foreground"
          aria-busy="true"
        >
          Checking your session…
        </div>
      }
    >
      <VerifiedNotes />
    </Suspense>
  );
}
