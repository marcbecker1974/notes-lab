import "server-only";

import { redirect } from "next/navigation";

import { hasVerifiedUser, LOGIN_PATH } from "@/lib/auth/protected-routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side check for private pages (Sprint 2, S2-R2). Verifies the session on the
 * server before any private content is rendered, and redirects to the sign-in page
 * otherwise. `getClaims()` verifies the token signature (it asks the Auth server for
 * projects without asymmetric signing keys) and refreshes a token that is about to
 * expire; the proxy has already refreshed the cookies for this request.
 *
 * The proxy is only an early, optimistic redirect; this check is the one that
 * decides, so a page never depends on the proxy alone. Call it from a component
 * inside <Suspense> (cacheComponents), and never inside try/catch (redirect throws).
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !hasVerifiedUser(claims)) {
    redirect(LOGIN_PATH);
  }
  return claims;
}
