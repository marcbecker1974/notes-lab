// Local development must use http://127.0.0.1:3000: the Supabase redirect
// allow-list and the PKCE cookies are per origin, so "localhost" breaks the
// Google round trip. Pure function so scripts/test-auth.mts can test it.

/** The same URL on 127.0.0.1 if `href` is on localhost, otherwise null. */
export function canonicalLocalUrl(href: string): string | null {
  const url = new URL(href);
  if (url.hostname !== "localhost") return null;
  url.hostname = "127.0.0.1";
  return url.toString();
}
