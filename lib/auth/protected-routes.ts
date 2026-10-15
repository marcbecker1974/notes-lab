// Which request paths need a signed-in user (Sprint 2, S2-R2). Pure and import-free
// so `npm run test:auth` (plain Node) can test it.
//
// Deny by default: every path is protected unless it is listed as public below, so
// a new private route (or a variant of /notes) never becomes public by accident.

export const LOGIN_PATH = "/auth/login";

// Sub-trees that stay reachable without a session: the starter landing page, the
// sign-in, sign-up, callback, confirmation and password pages under /auth, and the
// starter's /login prefix.
const PUBLIC_TREES = ["/auth", "/login"] as const;

// Paths with dot-segments, backslashes, encoded slashes or dots, or control
// characters are never treated as public: they can be used to dress a private path
// up as a public one (for example /auth/..%2fnotes). Failing closed only sends such
// a request to the sign-in page.
const SUSPICIOUS = /(^|\/)\.\.?(\/|$)|\\|%2f|%5c|%2e|[\u0000-\u001f\u007f]/i;

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** True for the few paths that do not need a signed-in user. */
export function isPublicPath(pathname: string): boolean {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  if (SUSPICIOUS.test(pathname)) return false;
  if (pathname === "/") return true;
  return PUBLIC_TREES.some((base) => isUnder(pathname, base));
}

/**
 * True only for verified JWT claims that identify a real signed-in user: a
 * non-empty `sub`, and not an anonymous sign-in (those carry the `authenticated`
 * database role too).
 */
export function hasVerifiedUser(claims: unknown): boolean {
  if (typeof claims !== "object" || claims === null) return false;
  const { sub, is_anonymous } = claims as {
    sub?: unknown;
    is_anonymous?: unknown;
  };
  return typeof sub === "string" && sub.length > 0 && is_anonymous !== true;
}
