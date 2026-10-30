import { loadLatestConversation } from "@/lib/ai/chat-store";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's newest conversation, so the chat survives a reload. */
export async function GET() {
  await requireUser(); // redirect throws: deliberately outside try/catch
  const supabase = await createClient();
  const result = await loadLatestConversation(supabase);
  if (!result) {
    // A failed read must not look like "no conversation yet".
    return Response.json(
      { error: "Your conversation could not be loaded." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
