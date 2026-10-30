export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Only conversational text crosses the browser/server boundary. */
export function parseChatMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) return null;
  const messages: ChatMessage[] = [];
  let total = 0;
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" ||
        item.role !== (index % 2 === 0 ? "user" : "assistant") ||
        typeof item.content !== "string" || !item.content.trim() ||
        item.content.length > 8000) return null;
    total += item.content.length;
    if (total > 60000) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
}
