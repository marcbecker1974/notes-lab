// What the notes UI does when the database refuses a request because the session is
// gone (expired or signed out elsewhere): ask the server to re-check, which makes
// the server-side check on /notes redirect to the sign-in page. Pure and
// import-free so `npm run test:auth` can test it.

// NotesDbError kinds that can mean "the session is no longer valid". "forbidden" is
// what an expired or missing session turns into once anonymous access is closed
// (permission denied, or a rejected JWT).
export function isSessionLossKind(kind: string | null | undefined): boolean {
  return kind === "forbidden";
}

/**
 * Calls `refresh` at most once until `reset` is called, so a persistent permission
 * problem for a signed-in user cannot cause a refresh loop. Returns true when the
 * refresh was triggered.
 */
export function createSessionLossGate(refresh: () => void) {
  let fired = false;
  return {
    onError(kind: string | null | undefined): boolean {
      if (fired || !isSessionLossKind(kind)) return false;
      fired = true;
      refresh();
      return true;
    },
    /** Call after any successful request: the session works, so re-arm the gate. */
    reset(): void {
      fired = false;
    },
  };
}
