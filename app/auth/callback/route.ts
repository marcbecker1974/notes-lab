import { handleOAuthCallback } from "@/lib/auth/oauth-callback";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

// Supabase -> app leg of "Sign in with Google". Exchanges the PKCE code for a
// session on the server; the SSR client writes the session cookies. The
// redirect is built in lib/auth/oauth-callback.ts (relative Location: in dev
// nextUrl.origin reported localhost even for a 127.0.0.1 request).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  return handleOAuthCallback(request.nextUrl, (code) =>
    supabase.auth.exchangeCodeForSession(code),
  );
}
