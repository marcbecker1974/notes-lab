// Decides where the browser goes after Supabase returns from the OAuth flow.
// Kept free of Next.js and Supabase imports so it can be tested in isolation;
// the route handler supplies the real code exchange.

export const OAUTH_SUCCESS_PATH = "/protected";

export type OAuthErrorCode =
  | "oauth_cancelled"
  | "oauth_failed"
  | "oauth_missing_code";

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
    return failurePath(
      providerError === "access_denied" ? "oauth_cancelled" : "oauth_failed",
    );
  }

  const code = params.get("code");
  if (!code) return failurePath("oauth_missing_code");

  try {
    const { error } = await exchangeCode(code);
    return error ? failurePath("oauth_failed") : OAUTH_SUCCESS_PATH;
  } catch {
    return failurePath("oauth_failed");
  }
}
