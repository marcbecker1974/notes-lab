import { requireUser } from "@/lib/auth/require-user";
import { loadNotesForChat } from "@/lib/ai/chat-notes";
import { saveExchange } from "@/lib/ai/chat-store";
import { makeLibrarySearch } from "@/lib/ai/library-search";
import { parseChatMessages } from "@/lib/ai/messages";
import { buildNotesContext } from "@/lib/ai/notes-context";
import { ChatServiceError, getChatReply } from "@/lib/ai/openrouter";
import { rejectForeignOrigin } from "@/lib/ai/request-guard";
import { createClient } from "@/lib/supabase/server";

/** Private endpoint: the existing proxy and this server check both apply. */
export async function POST(request: Request) {
  await requireUser(); // redirect throws: deliberately outside try/catch

  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Send JSON." }, { status: 415 });
  }

  let body: unknown;
  try {
    // Bound the request before parsing, including requests with no Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 260_000) {
        await reader.cancel();
        return Response.json({ error: "The conversation is too long." }, { status: 413 });
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const input = body as { messages?: unknown; conversationId?: unknown } | null;
  const conversationId =
    typeof input?.conversationId === "number" && Number.isSafeInteger(input.conversationId) && input.conversationId > 0
      ? input.conversationId
      : null;
  const messages = parseChatMessages(input?.messages);
  if (!messages) {
    return Response.json({ error: "The conversation is invalid or too long. Start a new conversation." }, { status: 400 });
  }

  // The reads, the library search and the save below use the user's own session (RLS).
  const supabase = await createClient();
  const notes = await loadNotesForChat(supabase);
  const notesContext = notes ? buildNotesContext(notes) : null;

  try {
    // The model may call search_library; the search runs here with the user's own session.
    const reply = await getChatReply(messages, notesContext, makeLibrarySearch(supabase));
    // Persistence sits on top of the reply: a failed save never blocks the answer.
    const stored = await saveExchange(supabase, conversationId, messages[messages.length - 1].content, reply.content);
    return Response.json(
      { ...reply, conversationId: stored.id ?? conversationId, saved: stored.saved },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const known = error instanceof ChatServiceError;
    return Response.json(
      { error: known ? error.message : "The chat is temporarily unavailable." },
      { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
