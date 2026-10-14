// User-facing text for ?error=<code> on the sign-in page.
const MESSAGES: Record<string, string> = {
  oauth_cancelled: "Google sign-in was cancelled. You can try again.",
  oauth_failed: "Google sign-in did not complete. Please try again.",
  oauth_missing_code:
    "The sign-in response was incomplete. Please start Google sign-in again.",
};

export function authErrorMessage(code: string | undefined): string | null {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : null;
}
