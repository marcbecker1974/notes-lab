"use client";

import { useActionState } from "react";

import { addToLibrary, type AddState } from "@/app/library/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TONE = {
  saved: "text-foreground",
  updated: "text-foreground",
  missing: "text-destructive",
  invalid: "text-destructive",
  error: "text-destructive",
} as const;

export function LibraryForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addToLibrary, null);

  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="articles">Add Wikipedia articles</Label>
      <Textarea
        id="articles"
        name="articles"
        rows={5}
        maxLength={5000}
        placeholder={"Alan Turing\nhttps://en.wikipedia.org/wiki/Ada_Lovelace"}
        aria-describedby="articles-help"
        disabled={pending}
      />
      <p id="articles-help" className="text-xs text-muted-foreground">
        One link or title per line, up to 10. Titles are searched on English Wikipedia; paste a link for other languages.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Fetching and saving…" : "Add to library"}
      </Button>

      <div aria-live="polite" className="space-y-2 text-sm">
        {pending && <p className="text-muted-foreground">Articles are fetched one at a time, this can take a few seconds each.</p>}
        {state?.message && <p className="text-muted-foreground">{state.message}</p>}
        {state?.results.map((result, i) => (
          <p key={`${result.input}-${i}`} className={cn(TONE[result.status])}>
            {result.url ? (
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                {result.title}
              </a>
            ) : (
              <span className="font-medium">{result.input}</span>
            )}
            {": "}
            {result.message}
          </p>
        ))}
      </div>
    </form>
  );
}
