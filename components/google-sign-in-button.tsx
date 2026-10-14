"use client";

import { Button } from "@/components/ui/button";
import { canonicalLocalUrl } from "@/lib/auth/dev-origin";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Coming back with the browser's Back button from Google restores this page
  // from the back/forward cache with the button still disabled.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setIsLoading(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const handleClick = async () => {
    setError(null);
    const local = canonicalLocalUrl(window.location.href);
    if (local) {
      setError(
        `Open the app at ${new URL(local).origin} (not localhost) to sign in with Google.`,
      );
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Supabase -> app leg. Must be in the Supabase redirect allow-list and
        // use the same origin the user is browsing (127.0.0.1 locally).
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser is already navigating to Google.
      if (error) throw error;
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={isLoading}
      >
        <GoogleLogo />
        {isLoading ? "Redirecting to Google..." : "Continue with Google"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
