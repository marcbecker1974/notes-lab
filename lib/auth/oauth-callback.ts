// Decides where the browser goes after Supabase returns from the OAuth flow.
// Kept free of Next.js and Supabase imports so it can be tested in isolation;
// the route handler supplies the real code exchange.

// Where every successful sign-in, email confirmation and password update ends.
// Navigation only: /notes stays open to anonymous visitors (docs/ARCHITECTURE.md);
// /protected remains as the auth test page.
export const POST_LOGIN_PATH = "/notes";

export type OAuthErrorCode =
  "oauth_cancelled" | "oauth_failed" | "oauth_missing_code" | "link_expired";

export type ExchangeCode = (code: string) => Promise<{ error: unknown | null }>;

const failurePath = (code: OAuthErrorCode) => `/auth/login?error=${code}`;

/** Returns the app path to redirect to. Never throws. */
export async function resolveOAuthCallback(
  url: URL,
  exchangeCode: ExchangeCode,
): Promise<string> {
  const params = url.searchParams;

  // The provider (via Supabase) reports failures as ?error=…&error_description=….
  // Only a fixed code is passed on; the raw text is never shown or reflected.
  const providerError = params.get("error");
  if (providerError) {
    // Supabase reports an expired or used email link as error_code=otp_expired.
    // It only selects the message; it is never evidence of a sign-in.
    if (params.get("error_code") === "otp_expired")
      return failurePath("link_expired");
    return failurePath(
      providerError === "access_denied" ? "oauth_cancelled" : "oauth_failed",
    );
  }

  const code = params.get("code");
  if (!code) return failurePath("oauth_missing_code");

  try {
    const { error } = await exchangeCode(code);
    return error ? failurePath("oauth_failed") : POST_LOGIN_PATH;
  } catch {
    return failurePath("oauth_failed");
  }
}

/**
 * Full callback decision as a redirect response. A relative Location keeps the
 * browser on the origin it came back on, so the session cookies just set are
 * sent. Success depends only on the code exchange: an existing session never
 * turns a failed exchange into a success.
 */
export async function handleOAuthCallback(
  url: URL,
  exchangeCode: ExchangeCode,
): Promise<Response> {
  const path = await resolveOAuthCallback(url, exchangeCode);
  return new Response(null, { status: 307, headers: { Location: path } });
}
