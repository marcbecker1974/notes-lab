"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  authEventAction,
  createLatestGate,
  identityAfterCheck,
  type Identity,
} from "@/lib/auth/latest";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// The two instances check at the same moment on load; they share one request.
let inFlightCheck: ReturnType<
  ReturnType<typeof createClient>["auth"]["getUser"]
> | null = null;
function sharedGetUser(supabase: ReturnType<typeof createClient>) {
  inFlightCheck ??= supabase.auth.getUser().finally(() => {
    inFlightCheck = null;
  });
  return inFlightCheck;
}

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
    let verifiedUserId: string | undefined; // user the shown email belongs to

    const verify = async () => {
      const isLatest = gate.begin();
      const { data, error } = await sharedGetUser(supabase);
      if (active && isLatest()) {
        verifiedUserId = data.user?.id;
        setEmail((prev) =>
          identityAfterCheck(prev, { user: data.user, error }),
        );
      }
    };

    // INITIAL_SESSION fires on subscribe, so no separate first check is needed.
    // auth-js also emits SIGNED_IN whenever the tab regains focus; for the user
    // already verified that is ignored, so focusing does not cause requests.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const action = authEventAction(event, session, verifiedUserId);
      if (action === "ignore") return;
      if (action === "clear") {
        gate.invalidate(); // outdated checks must not bring the email back
        verifiedUserId = undefined;
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
