// Offline: fetch is replaced, so these tests never contact Wikipedia or OpenRouter.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { chunkText } from "../lib/library/chunk.ts";
import { parseEntries } from "../lib/library/parse-input.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "server-only"
      ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const { fetchArticle, WIKIPEDIA_USER_AGENT } = await import("../lib/library/wikipedia.ts");
const { getEmbeddings, ChatServiceError } = await import("../lib/ai/openrouter.ts");
const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = await import("../lib/ai/config.ts");

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
const restore = () => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
};
// Fail closed: an unmocked test can never reach the network.
globalThis.fetch = async () => { throw new Error("Network disabled during offline tests"); };
process.env.OPENROUTER_API_KEY = "unit-test-key-never-real";
delete process.env.CHAT_TEST_STUB;

type Call = { url: string; init?: RequestInit };
function mockFetch(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (over: Record<string, unknown>) =>
  json({ query: { pages: [{ ns: 0, title: "Alan Turing", extract: "Alan Turing was a mathematician.", fullurl: "https://en.wikipedia.org/wiki/Alan_Turing", ...over }] } });

try {
  await test("chunks are at most 500 characters and overlap by about 100", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words);
    assert.ok(chunks.length > 5);
    for (const c of chunks) assert.ok(c.length <= 500 && c.length > 0);
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].slice(-100);
      const shared = tail.split(" ").slice(1).join(" "); // first word of the tail may be cut
      assert.ok(chunks[i].includes(shared.slice(0, 40)), `chunk ${i} should repeat the end of the previous one`);
    }
    // every word survives somewhere, in order
    assert.ok(chunks[0].startsWith("word0 "));
    assert.ok(chunks.at(-1)!.endsWith("word599"));
  });

  await test("chunking handles short, empty and unbroken text", () => {
    assert.deepEqual(chunkText("  short text  "), ["short text"]);
    assert.deepEqual(chunkText("   "), []);
    const blob = chunkText("x".repeat(1300));
    assert.ok(blob.length >= 3 && blob.every((c) => c.length <= 500));
  });

  await test("parses links and titles, drops blanks and repeats, limits the count", () => {
    const { entries, skipped } = parseEntries([
      "Alan Turing", "", "  alan_turing  ",
      "https://en.wikipedia.org/wiki/Ada_Lovelace#Early_life",
      "https://de.m.wikipedia.org/wiki/Zuse_Z3",
      "https://en.wikipedia.org/w/index.php?title=Grace_Hopper",
      "https://example.com/wiki/Evil", "https://en.wikipedia.org.evil.com/wiki/X",
      "file:///etc/passwd", "Bad|Title", "https://en.wikipedia.org/",
    ].join("\n"));
    assert.deepEqual(entries.slice(0, 4).map((e) => ("title" in e ? [e.lang, e.title] : e.error)),
      [["en", "Alan Turing"], ["en", "Ada Lovelace"], ["de", "Zuse Z3"], ["en", "Grace Hopper"]]);
    assert.ok(entries.slice(4).every((e) => "error" in e), "foreign hosts, schemes and bad titles are rejected");
    assert.equal(entries.length, 9); // "alan_turing" repeats "Alan Turing"
    assert.equal(skipped, 0);
    const many = parseEntries(Array.from({ length: 14 }, (_, i) => `Title ${i}`).join("\n"));
    assert.equal(many.entries.length, 10);
    assert.equal(many.skipped, 4);
  });

  await test("fetches one article per request with the identifying User-Agent", async () => {
    const calls = mockFetch(() => page({}));
    const result = await fetchArticle({ lang: "en", title: "alan turing" });
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin, "https://en.wikipedia.org");
    assert.equal(url.pathname, "/w/api.php");
    assert.equal(url.searchParams.get("redirects"), "1");
    assert.equal(url.searchParams.get("explaintext"), "1");
    assert.equal(url.searchParams.get("titles"), "alan turing");
    assert.ok(!(url.searchParams.get("titles") ?? "").includes("|"));
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["User-Agent"], WIKIPEDIA_USER_AGENT);
    assert.match(headers["User-Agent"], /^NotesLab\/\d.*marc\.becker@berlin\.de/);
    assert.deepEqual(result, { status: "ok", title: "Alan Turing", url: "https://en.wikipedia.org/wiki/Alan_Turing", text: "Alan Turing was a mathematician.", truncated: false });
  });

  await test("saves the real title and link after a redirect", async () => {
    mockFetch(() => page({ title: "Alan Turing", fullurl: "https://en.wikipedia.org/wiki/Alan_Turing" }));
    const result = await fetchArticle({ lang: "en", title: "A. M. Turing" });
    assert.equal(result.status === "ok" && result.title, "Alan Turing");
  });

  await test("reports missing pages, other namespaces and failures clearly", async () => {
    mockFetch(() => json({ query: { pages: [{ title: "Qwzxv", missing: true }] } }));
    assert.deepEqual(await fetchArticle({ lang: "en", title: "Qwzxv" }), { status: "missing" });
    mockFetch(() => page({ ns: 14 }));
    assert.equal((await fetchArticle({ lang: "en", title: "Category:X" })).status, "error");
    mockFetch(() => page({ fullurl: "https://evil.example/wiki/Alan_Turing" }));
    assert.equal((await fetchArticle({ lang: "en", title: "Alan Turing" })).status, "error");
    mockFetch(() => new Response("nope", { status: 429 }));
    const slow = await fetchArticle({ lang: "en", title: "Alan Turing" });
    assert.ok(slow.status === "error" && /slow down/.test(slow.message));
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal((await fetchArticle({ lang: "en", title: "Alan Turing" })).status, "error");
  });

  await test("long articles are cut and flagged", async () => {
    mockFetch(() => page({ extract: "a ".repeat(40_000) }));
    const result = await fetchArticle({ lang: "en", title: "Long" });
    assert.ok(result.status === "ok" && result.truncated && result.text.length <= 50_000);
  });

  await test("embeds with the fixed model and checks the dimension", async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    const calls = mockFetch(() => json({ data: [{ index: 1, embedding: vector }, { index: 0, embedding: vector }] }));
    const out = await getEmbeddings(["one", "two"]);
    assert.equal(out.length, 2);
    assert.equal(EMBEDDING_MODEL, "openai/text-embedding-3-small");
    assert.equal(EMBEDDING_DIMENSIONS, 1536);
    assert.equal(calls[0].url, "https://openrouter.ai/api/v1/embeddings");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.model, "openai/text-embedding-3-small");
    assert.deepEqual(body.input, ["one", "two"]);
    mockFetch(() => json({ data: [{ index: 0, embedding: [1, 2, 3] }] }));
    await assert.rejects(getEmbeddings(["one"]), ChatServiceError);
    mockFetch(() => json({ data: [{ index: 0, embedding: vector }] }));
    await assert.rejects(getEmbeddings(["one", "two"]), ChatServiceError);
  });

  await test("embedding errors never contain the provider body or the key", async () => {
    mockFetch(() => new Response("secret provider detail unit-test-key-never-real", { status: 500 }));
    await assert.rejects(getEmbeddings(["x"]), (e: Error) => e instanceof ChatServiceError && !/secret|unit-test/.test(e.message));
    mockFetch(() => new Response("x", { status: 402 }));
    await assert.rejects(getEmbeddings(["x"]), (e: ChatServiceError) => e.status === 503);
  });
} finally {
  restore();
}
