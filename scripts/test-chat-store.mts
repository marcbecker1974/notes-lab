// Offline: the chat persistence layer against a fake Supabase client (no network).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "server-only"
      ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const { createConversation, loadLatestConversation, saveExchange } = await import("../lib/ai/chat-store.ts");

type Call = { table: string; op: string; payload?: unknown; filters: string[] };

// Records each query and answers from `answers[table.op]`; awaiting a chain resolves it.
function fakeClient(answers: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        select: (cols: string) => { call.filters.push(`select:${cols}`); return chain; },
        insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return chain; },
        order: (col: string, o: { ascending: boolean }) => { call.filters.push(`order:${col}:${o.ascending}`); return chain; },
        eq: (col: string, v: unknown) => { call.filters.push(`eq:${col}:${v}`); return chain; },
        limit: (n: number) => { call.filters.push(`limit:${n}`); return chain; },
        single: () => chain,
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...answers[`${table}.${call.op}`] }),
      };
      return chain;
    },
  };
  return { client: client as never, calls };
}

await test("loads the newest conversation with its messages in order", async () => {
  const { client, calls } = fakeClient({
    "conversations.select": { data: [{ id: 7 }] },
    "messages.select": { data: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] },
  });
  const result = await loadLatestConversation(client);
  assert.deepEqual(result, { id: 7, messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] });
  assert.ok(calls[0].filters.includes("order:id:false") && calls[0].filters.includes("limit:1"));
  assert.ok(calls[1].filters.includes("eq:conversation_id:7") && calls[1].filters.includes("order:id:true"));
  // Only explicit, user-safe columns: never user_id.
  assert.ok(calls.every((c) => c.filters.every((f) => !f.includes("user_id"))));
});

await test("no conversation or a database error gives null, never an exception", async () => {
  assert.equal(await loadLatestConversation(fakeClient({ "conversations.select": { data: [] } }).client), null);
  assert.equal(await loadLatestConversation(fakeClient({ "conversations.select": { error: { message: "secret" } } }).client), null);
  assert.equal(await loadLatestConversation(fakeClient({
    "conversations.select": { data: [{ id: 1 }] }, "messages.select": { error: { message: "secret" } },
  }).client), null);
});

await test("saveExchange creates a conversation titled from the first message, then saves both rows", async () => {
  const { client, calls } = fakeClient({ "conversations.insert": { data: { id: 9 } } });
  assert.equal(await saveExchange(client, null, "Erste Frage", "Antwort"), 9);
  assert.deepEqual(calls[0].payload, { title: "Erste Frage" });
  assert.deepEqual(calls[1].payload, [
    { conversation_id: 9, role: "user", content: "Erste Frage" },
    { conversation_id: 9, role: "assistant", content: "Antwort" },
  ]);
});

await test("saveExchange appends to an existing conversation without creating another", async () => {
  const { client, calls } = fakeClient({});
  assert.equal(await saveExchange(client, 4, "Mehr", "Gern"), 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "messages");
});

await test("a refused save (RLS, foreign conversation id) returns null", async () => {
  const { client } = fakeClient({ "messages.insert": { error: { code: "42501" } } });
  assert.equal(await saveExchange(client, 123, "x", "y"), null);
  assert.equal(await saveExchange(fakeClient({ "conversations.insert": { error: { code: "42501" } } }).client, null, "x", "y"), null);
});

await test("titles are shortened to the 100 characters the table allows", async () => {
  const { client, calls } = fakeClient({ "conversations.insert": { data: { id: 1 } } });
  await createConversation(client, "x".repeat(300));
  assert.equal((calls[0].payload as { title: string }).title.length, 100);
});
