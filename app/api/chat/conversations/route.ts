import { createConversation } from "@/lib/ai/chat-store";
import { rejectForeignOrigin } from "@/lib/ai/request-guard";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

/** "New conversation": creates an empty one, which then becomes the newest. */
export async function POST(request: Request) {
  await requireUser(); // redirect throws: deliberately outside try/catch
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;

  const supabase = await createClient();
  const id = await createConversation(supabase);
  if (id === null) {
    return Response.json(
      { error: "Could not start a new conversation." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
