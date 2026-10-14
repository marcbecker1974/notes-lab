"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  createLatestGate,
  identityAfterCheck,
  type Identity,
} from "@/lib/auth/latest";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Sign-in status for the notes header (rendered twice: in the top bar from 768px
// up, and next to the app title below 768px; the caller hides the other one).
// Display only: /notes stays open to anonymous visitors and the notes data never
// depends on this component. A session in the browser is confirmed with
// getUser(), which asks the Supabase Auth server, so the shown identity is not
// just whatever the cookie claims. Only the newest check may update the state.
export function AuthStatus({ className }: { className?: string }) {
  const [email, setEmail] = useState<Identity>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const gate = createLatestGate();
    let active = true;

    const verify = async () => {
      const isLatest = gate.begin();
      const { data, error } = await supabase.auth.getUser();
      if (active && isLatest())
        setEmail((prev) =>
          identityAfterCheck(prev, { user: data.user, error }),
        );
    };

    // INITIAL_SESSION fires on subscribe, so no separate first check is needed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return; // same user, nothing to re-check
      if (!session) {
        gate.invalidate(); // outdated checks must not bring the email back
        setEmail(null);
        return;
      }
      // Do not await Supabase calls inside this callback; defer instead.
      setTimeout(() => void verify(), 0);
    });
    return () => {
      active = false;
      gate.invalidate();
      sub.subscription.unsubscribe();
    };
  }, []);

  // Reserve the space while checking so the header does not jump.
  if (email === undefined)
    return <div className={cn("h-9 w-20 shrink-0", className)} aria-hidden />;

  if (email === null) {
    return (
      <Button
        asChild
        size="sm"
        variant="outline"
        className={cn("shrink-0", className)}
      >
        <Link href="/auth/login">Login</Link>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2",
        className,
      )}
    >
      {/* Screen readers get the labelled address at every width; the visible
          copy (768px and up only) is hidden from them to avoid reading it twice. */}
      <span className="sr-only">Signed in as {email}</span>
      <span
        aria-hidden="true"
        className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:inline"
        title={email}
      >
        {email}
      </span>
      <LogoutButton compact />
    </div>
  );
}
