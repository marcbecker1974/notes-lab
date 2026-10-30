import { loadLatestConversation } from "@/lib/ai/chat-store";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's newest conversation, so the chat survives a reload. */
export async function GET() {
  await requireUser(); // redirect throws: deliberately outside try/catch
  const supabase = await createClient();
  const conversation = await loadLatestConversation(supabase);
  return Response.json(
    { conversation },
    { headers: { "Cache-Control": "no-store" } },
  );
}
