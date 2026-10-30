import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatMessage } from "./messages.ts";

// Chat persistence (CHAT-3). Every call runs with the signed-in user's own session
// (server client built from the request cookie), so RLS limits it to their rows; the
// app never sends or reads user_id. Explicit columns, errors never carry provider or
// database text to the caller (functions return null/false instead).

const MAX_STORED = 60; // same limit as the API: one conversation never exceeds it

export type StoredConversation = { id: number; messages: ChatMessage[] };

/**
 * The user's newest conversation with its messages in order. `{ conversation: null }`
 * means there is none yet; `null` means the read failed, so the caller can tell
 * "nothing saved" from "could not be read".
 */
export async function loadLatestConversation(
  supabase: SupabaseClient,
): Promise<{ conversation: StoredConversation | null } | null> {
  const found = await supabase
    .from("conversations")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  if (found.error || !found.data) return null;
  if (!found.data.length) return { conversation: null };
  const id = found.data[0].id as number;

  const rows = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("id", { ascending: true })
    .limit(MAX_STORED);
  if (rows.error || !rows.data) return null;
  return {
    conversation: {
      id,
      messages: rows.data.map((row) => ({
        role: row.role as ChatMessage["role"],
        content: row.content as string,
      })),
    },
  };
}

/** Creates an empty conversation for the signed-in user; returns its id or null. */
export async function createConversation(
  supabase: SupabaseClient,
  title: string | null = null,
): Promise<number | null> {
  const result = await supabase
    .from("conversations")
    .insert({ title: title ? title.slice(0, 100) : null })
    .select("id")
    .single();
  return result.error || !result.data ? null : (result.data.id as number);
}

/**
 * Appends one exchange (user message, then the reply) to a conversation, creating the
 * conversation when conversationId is null. `id` is the conversation to continue (also
 * when only the messages failed, so the next send reuses it instead of creating another
 * one); `saved` says whether the messages are stored. A refused insert (for example an
 * id that is not the user's: the RLS policy refuses) gives `saved: false`.
 */
export async function saveExchange(
  supabase: SupabaseClient,
  conversationId: number | null,
  userText: string,
  assistantText: string,
): Promise<{ id: number | null; saved: boolean }> {
  const id = conversationId ?? (await createConversation(supabase, userText));
  if (id === null) return { id: null, saved: false };
  // One statement: both rows or neither; ids ascend in the order given.
  const result = await supabase.from("messages").insert([
    { conversation_id: id, role: "user", content: userText },
    { conversation_id: id, role: "assistant", content: assistantText },
  ]);
  return { id, saved: !result.error };
}
