import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { PageActions } from "@/components/library/page-actions";
import { LibraryForm } from "@/components/library/library-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listPages } from "@/lib/library/library-store";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My library – Notes Lab" };

async function SavedArticles() {
  const supabase = await createClient();
  const pages = await listPages(supabase); // RLS: only the signed-in user's pages
  if (!pages) {
    return <p className="text-sm text-destructive">Your library could not be loaded. Please reload the page.</p>;
  }
  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground">No articles yet. Add some above.</p>;
  }
  return (
    <ul className="divide-y rounded-md border">
      {pages.map((page) => (
        <li key={page.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-medium text-primary underline-offset-4 hover:underline"
            >
              {page.title}
            </a>
            <time dateTime={page.last_fetched_at} className="text-xs text-muted-foreground">
              fetched {new Date(page.last_fetched_at).toISOString().slice(0, 10)}
            </time>
          </div>
          <PageActions id={page.id} title={page.title} />
        </li>
      ))}
    </ul>
  );
}

// Private like /notes: the session is verified on the server before anything renders
// (inside <Suspense> because the check reads cookies). Fetching, embedding and saving
// happen in the addToLibrary Server Action; this page never sees the API key.
async function VerifiedLibrary() {
  await requireUser();
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to notes">
          <Link href="/notes"><ArrowLeft /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">My library</h1>
      </header>
      <LibraryForm />
      <section aria-labelledby="saved-heading" className="space-y-3">
        <h2 id="saved-heading" className="text-lg font-medium">Saved articles</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your library…</p>}>
          <SavedArticles />
        </Suspense>
      </section>
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground" aria-busy="true">
          Checking your session…
        </div>
      }
    >
      <VerifiedLibrary />
    </Suspense>
  );
}
