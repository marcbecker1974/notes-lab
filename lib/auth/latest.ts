// Small helpers for the notes-header AuthStatus. Pure, relative-import-free, so
// scripts/test-auth.mts can test them without a browser.

/**
 * Orders async checks: only the most recently started one may apply its result,
 * and `invalidate()` (e.g. on sign-out) makes every check still in flight stale.
 */
export function createLatestGate() {
  let current = 0;
  return {
    begin(): () => boolean {
      const id = ++current;
      return () => id === current;
    },
    invalidate(): void {
      current++;
    },
  };
}

export type Identity = string | null | undefined; // undefined = still checking

/**
 * Identity to show after a getUser() call. A definite answer wins; a transient
 * failure (network, server error) keeps what was shown before instead of
 * turning a signed-in user into "Login". Without a previous answer it fails
 * closed to anonymous.
 */
export function identityAfterCheck(
  previous: Identity,
  result: {
    user: { email?: string | null } | null;
    error: { name?: string; status?: number } | null;
  },
): Identity {
  if (result.user) return result.user.email ?? "Signed in";
  const e = result.error;
  const definite =
    !e ||
    e.name === "AuthSessionMissingError" ||
    e.status === 401 ||
    e.status === 403;
  if (definite) return null;
  return previous === undefined ? null : previous;
}
