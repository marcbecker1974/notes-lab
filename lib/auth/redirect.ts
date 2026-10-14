// Redirect validation for auth routes. Relative imports only, so the plain
// Node test script (scripts/test-auth.mts) can load this file.

// Fixed base used only to resolve and normalise the value; it is never returned.
const BASE = "http://base.invalid";

/**
 * Returns a same-site path (path + query + hash) for a user-supplied `next`
 * value, or `fallback` when it is missing or unsafe. The value must be an
 * absolute path; it is then normalised the way a browser would, and the
 * normalised result is what gets checked and returned.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//")
  )
    return fallback;
  // Browsers treat backslashes as "/" and strip tabs and newlines.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;

  const url = new URL(next, BASE);
  if (url.origin !== BASE) return fallback;
  // Dot segments are normalised away: "/.//evil.example" becomes the pathname
  // "//evil.example", which a browser would read as protocol-relative.
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("//") ? fallback : path;
}

// Where a password-recovery link must end: the form that sets a new password.
export const PASSWORD_UPDATE_PATH = "/auth/update-password";

/**
 * Destination after /auth/confirm verified a token-hash email link. A recovery
 * link always goes to the password form (a recovery session shown on /notes
 * would never ask for the new password); every other type follows the
 * validated `next` and otherwise falls back to `fallback`.
 */
export function confirmRedirectPath(
  type: string | null | undefined,
  next: string | null | undefined,
  fallback: string,
): string {
  return type === "recovery"
    ? PASSWORD_UPDATE_PATH
    : safeRedirectPath(next, fallback);
}
