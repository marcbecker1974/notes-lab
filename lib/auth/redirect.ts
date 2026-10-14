// Redirect validation for auth routes. Relative imports only, so the plain
// Node test script (scripts/test-auth.mts) can load this file.

/**
 * Returns a same-origin path (path + query + hash) for a user-supplied
 * `next` value, or `fallback` when it is missing or unsafe. The value is
 * resolved against the trusted application origin and rejected if the result
 * leaves that origin, which also catches browser-normalised tricks such as
 * "/\t/evil.com" or "/\\evil.com".
 */
export function safeRedirectPath(
  next: string | null | undefined,
  origin: string,
  fallback: string,
): string {
  if (typeof next !== "string" || next === "") return fallback;
  // Must be an absolute path on this site: "/x", not "//host", "x" or "https://…".
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // Backslashes and control characters are treated as "/" or stripped by browsers.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(next, origin);
  } catch {
    return fallback;
  }
  if (resolved.origin !== new URL(origin).origin) return fallback;
  // Dot segments are normalised away: "/.//evil.example" resolves to the pathname
  // "//evil.example", which a browser would read as protocol-relative.
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  if (path.startsWith("//")) return fallback;
  return path;
}
