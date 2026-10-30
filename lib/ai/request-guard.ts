/**
 * Cookie-authenticated POST requests must come from this origin, including in dev.
 * Next may use an internal localhost URL even when the browser uses 127.0.0.1, so the
 * Origin is compared against the actual HTTP Host, which browsers cannot forge.
 * Returns a 403 response to send, or null if the origin is fine.
 */
export function rejectForeignOrigin(request: Request): Response | null {
  const expectedOrigin = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expectedOrigin.host = host;
  if (!host || request.headers.get("origin") !== expectedOrigin.origin) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  return null;
}
