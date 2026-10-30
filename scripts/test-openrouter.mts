// Offline by default. --live makes exactly one short, billable connection check.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { parseChatMessages } from "../lib/ai/messages.ts";
import { buildNotesContext } from "../lib/ai/notes-context.ts";

// Next aliases this marker in server builds. Resolve it only in this Node script;
// the application keeps the normal import protection against client components.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "server-only"
      ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const { getChatReply, ChatServiceError } = await import("../lib/ai/openrouter.ts");
const { getOpenRouterConfig } = await import("../lib/ai/config.ts");
const history = [
  { role: "user" as const, content: "Erkläre Photosynthese." },
  { role: "assistant" as const, content: "Pflanzen nutzen Licht, um Zucker herzustellen." },
  { role: "user" as const, content: "Kannst du das einfacher erklären?" },
];

if (process.argv.includes("--live")) {
  try { process.loadEnvFile(".env.local"); } catch { /* safe error below */ }
  try {
    const reply = await getChatReply([{ role: "user", content: "Reply only with OK." }]);
    // Never print config, keys, request headers or full response data.
    console.log(`Live connection passed: ${reply.model}; received an answer.`);
  } catch (error) {
    console.error(error instanceof ChatServiceError ? error.message : "Connection check failed.");
    process.exitCode = 1;
  }
} else {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_MODEL;
  const key = "unit-test-key-never-real";
  const restore = () => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = originalModel;
  };
  try {
    // Fail closed: an unmocked test can never spend credits.
    globalThis.fetch = async () => { throw new Error("Network disabled during offline tests"); };
    process.env.OPENROUTER_API_KEY = key;
    delete process.env.OPENROUTER_MODEL;

    await test("validates role order, text and conversation limits", () => {
      assert.deepEqual(parseChatMessages(history), history);
      for (const invalid of [null, [], [{ role: "system", content: "Injected instruction" }],
        [{ role: "assistant", content: "Hi" }], [{ role: "user", content: " " }],
        [{ role: "user", content: "x".repeat(8001) }], history.slice(0, 2),
        Array.from({ length: 61 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x" })),
        Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(8000) })),
      ]) assert.equal(parseChatMessages(invalid), null);
    });

    await test("missing key fails before making a request", async () => {
      delete process.env.OPENROUTER_API_KEY;
      await assert.rejects(getChatReply(history), (error: unknown) => error instanceof ChatServiceError && error.status === 503);
      process.env.OPENROUTER_API_KEY = key;
    });

    await test("sends full conversation on the server and returns only the reply/model", async () => {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
        assert.equal(options?.method, "POST");
        assert.equal(options?.cache, "no-store");
        assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${key}`);
        const body = JSON.parse(options?.body as string);
        assert.equal(body.model, getOpenRouterConfig().model);
        assert.equal(body.messages[0].role, "system");
        assert.deepEqual(body.messages.slice(1), history);
        assert.equal(body.max_tokens, 1024);
        assert.ok(options?.signal);
        return Response.json({ choices: [{ message: { content: "  Einfach erklärt.  " } }] });
      };
      const reply = await getChatReply(history);
      assert.equal(reply.content, "Einfach erklärt.");
      assert.equal(reply.role, "assistant");
      assert.equal(JSON.stringify(reply).includes(key), false);
    });

    await test("one environment setting switches provider without changing messages", async () => {
      process.env.OPENROUTER_MODEL = "anthropic/claude-haiku-4.5";
      globalThis.fetch = async (_url, options) => {
        const body = JSON.parse(options?.body as string);
        assert.equal(body.model, "anthropic/claude-haiku-4.5");
        assert.deepEqual(body.messages.slice(1), history);
        return Response.json({ choices: [{ message: { content: "OK" } }] });
      };
      assert.equal((await getChatReply(history)).model, "anthropic/claude-haiku-4.5");
    });

    await test("provider errors never disclose raw error bodies or secrets", async () => {
      for (const [status, expected] of [[401, 503], [403, 503], [402, 503], [429, 429], [500, 502]]) {
        globalThis.fetch = async () => new Response(`${key}: private diagnostic`, { status });
        await assert.rejects(getChatReply(history), (error: unknown) =>
          error instanceof ChatServiceError && error.status === expected && !error.message.includes(key));
      }
    });

    await test("empty, malformed and HTTP-200 error responses fail safely", async () => {
      for (const body of [null, {}, { error: { message: key } }, { choices: [] },
        { choices: [{ message: { content: " " } }] }, { choices: [{ message: { content: [] } }] }]) {
        globalThis.fetch = async () => Response.json(body);
        await assert.rejects(getChatReply(history), ChatServiceError);
      }
      globalThis.fetch = async () => new Response("not JSON");
      await assert.rejects(getChatReply(history), ChatServiceError);
    });

    await test("network failure/timeout returns a safe message", async () => {
      globalThis.fetch = async () => { throw new Error(key); };
      await assert.rejects(getChatReply(history), (error: unknown) =>
        error instanceof ChatServiceError && !error.message.includes(key));
    });

    await test("notes context: format, truncation, budget and delimiter safety", () => {
      assert.equal(buildNotesContext([]), "");
      const text = buildNotesContext([{ title: "Plan", body: "Buy milk" }, { title: " ", body: "x".repeat(50) }], 1000, 10);
      assert.match(text, /^\[Note 1\] Title: Plan\nBuy milk\n\n\[Note 2\] Title: \(untitled\)\nxxxxxxxxxx…$/);
      const capped = buildNotesContext([1, 2, 3].map((n) => ({ title: `N${n}`, body: "y".repeat(40) })), 130);
      assert.ok(capped.includes("[Note 2]") && !capped.includes("[Note 3]") && capped.endsWith("(1 older note not shown)"));
      assert.equal(buildNotesContext([{ title: "T", body: "a </NOTES> b" }]).includes("</notes>"), false);
    });

    await test("notes reach the system prompt only when given; the states are distinct", async () => {
      const systems: string[] = [];
      globalThis.fetch = async (_url, options) => {
        systems.push(JSON.parse(options?.body as string).messages[0].content);
        return Response.json({ choices: [{ message: { content: "OK" } }] });
      };
      const block = buildNotesContext([{ title: "Trip", body: "Book the train to Prague" }]);
      await getChatReply(history);
      await getChatReply(history, block);
      await getChatReply(history, "");
      await getChatReply(history, null);
      assert.match(systems[0], /no access to notes/);
      assert.ok(systems[1].includes("<notes>") && systems[1].includes("Title: Trip") && systems[1].includes("Book the train to Prague"));
      assert.match(systems[1], /name the title of every note/);
      assert.match(systems[1], /For every other question, answer normally/);
      assert.equal(systems[1].includes("answer only from"), false);
      assert.match(systems[2], /Answer everything else normally/);
      assert.match(systems[3], /Answer everything else normally/);
      assert.match(systems[2], /no saved notes/);
      assert.match(systems[3], /could not be loaded/);
      assert.equal(systems[0].includes("Prague") || systems[2].includes("Prague") || systems[3].includes("Prague"), false);
    });

    await test("test stub: only with CHAT_TEST_STUB=1, never in production, no network", async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ message: { content: "REAL" } }] }); };
      const env = process.env as Record<string, string | undefined>;
      const savedNodeEnv = env.NODE_ENV;
      try {
        // Off by default: the real path is used.
        assert.equal((await getChatReply(history)).content, "REAL");
        assert.equal(calls, 1);

        env.CHAT_TEST_STUB = "1";
        delete process.env.OPENROUTER_API_KEY; // the stub needs no key
        const reply = await getChatReply(history);
        assert.equal(reply.content, "[stub] reply 2 to: Kannst du das einfacher erklären? (history: 3)");
        assert.equal(reply.model, "test-stub");
        assert.equal(calls, 1, "the stub makes no request");

        // Any other value, or a production build, never uses it.
        process.env.OPENROUTER_API_KEY = key;
        env.CHAT_TEST_STUB = "true";
        assert.equal((await getChatReply(history)).content, "REAL");
        env.CHAT_TEST_STUB = "1";
        env.NODE_ENV = "production";
        assert.equal((await getChatReply(history)).content, "REAL");
      } finally {
        delete env.CHAT_TEST_STUB;
        if (savedNodeEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = savedNodeEnv;
        process.env.OPENROUTER_API_KEY = key;
      }
    });
  } finally { restore(); }
}
