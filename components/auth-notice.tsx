import { authErrorMessage } from "@/lib/auth/messages";

// Shows the message for ?error=<code> (e.g. a cancelled Google sign-in).
export async function AuthNotice({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const message = authErrorMessage(typeof error === "string" ? error : undefined);
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 text-sm text-red-500">
      {message}
    </p>
  );
}
