"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { refreshPage, removePage, type PageActionResult } from "@/app/library/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function PageActions({ id, title }: { id: number; title: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<PageActionResult | null>(null);

  const run = (action: (id: number) => Promise<PageActionResult>) =>
    startTransition(async () => {
      setResult(null);
      try {
        setResult(await action(id));
      } catch {
        setResult({ ok: false, message: "Something went wrong. Please try again." });
      }
    });

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(refreshPage)} aria-label={`Refresh ${title}`}>
          <RefreshCw className={pending ? "animate-spin" : undefined} /> Refresh
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(true)} aria-label={`Remove ${title}`}>
          <Trash2 /> Remove
        </Button>
      </div>
      <p aria-live="polite" className={result?.ok === false ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {pending ? "Working…" : result?.message}
      </p>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The article and all its saved chunks are deleted from your library. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(removePage)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
