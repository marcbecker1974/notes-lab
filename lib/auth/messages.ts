// User-facing text for ?error=<code> on the sign-in page. The callback serves
// both Google sign-in and email confirmation links, so the generic texts are
// neutral about which one failed.
const MESSAGES: Record<string, string> = {
  oauth_cancelled: "Google sign-in was cancelled. You can try again.",
  oauth_failed:
    "Sign-in could not be completed. If you just confirmed your email, sign in with your password. Otherwise please try again.",
  link_expired:
    "This confirmation link has expired or was already used. Sign in with your password, or sign up again to get a new link.",
  oauth_missing_code:
    "The sign-in response was incomplete. Please sign in again.",
};

export function authErrorMessage(code: string | undefined): string | null {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : null;
}
