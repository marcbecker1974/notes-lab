"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LogoutButtonProps = { compact?: boolean };

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const logout = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/auth/login");
    } catch {
      setFailed(true);
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={logout}
        disabled={loading}
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
      >
        {loading ? "Logging out…" : "Logout"}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          Logout failed. Try again.
        </span>
      )}
    </>
  );
}
