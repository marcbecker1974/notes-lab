import { OAUTH_SUCCESS_PATH, resolveOAuthCallback } from "@/lib/auth/oauth-callback";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

// Supabase -> app leg of "Sign in with Google". Exchanges the PKCE code for a
// session on the server; the SSR client writes the session cookies.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const path = await resolveOAuthCallback(request.nextUrl, (code) =>
    supabase.auth.exchangeCodeForSession(code),
  );
  // A replayed callback (Back button, reload) fails the one-time code exchange
  // although the first attempt already created a session: go on in that case.
  if (path !== OAUTH_SUCCESS_PATH && request.nextUrl.searchParams.get("code")) {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      return new Response(null, {
        status: 307,
        headers: { Location: OAUTH_SUCCESS_PATH },
      });
    }
  }
  // Relative Location: the browser stays on the origin it came back on, so the
  // session cookies just set are sent. (nextUrl.origin reported localhost even
  // for a 127.0.0.1 request in dev, which would have switched origins.)
  return new Response(null, { status: 307, headers: { Location: path } });
}
